import pytest
from ruamel.yaml import YAML

from pathlib import Path

from scripts import ingest_hepdata, linkcheck
from scripts.phenomap import hepdata

ROOT = Path(__file__).parent.parent
FIX = Path(__file__).parent / "fixtures"
TABLE = YAML(typ="safe").load(FIX / "hepdata" / "table.yaml")
LABEL_MAP = YAML(typ="safe").load(ROOT / "data" / "hepdata_label_map.yaml")
REF = "hepdata:ins1234567/Table 5"


def test_summarize_symmetric_and_asymmetric():
    out = hepdata.summarize(TABLE, LABEL_MAP, REF)
    assert [u["category"] for u in out] == ["stat", "lumi", "energy_scale", "other"]
    by = {u["category"]: u for u in out}
    # stat: 2/100, 6/200, 1/50 -> 2, 3, 2 %
    assert by["stat"]["size"] == {"range": [2.0, 3.0], "asymmetric": False}
    # 2.46% in every bin -> rounded to 2 s.f.
    assert by["lumi"]["size"]["range"] == [2.5, 2.5]
    # JES max(|plus|,|minus|): 5/100, 8/200, 1.5/50 -> 5, 4, 3 %
    assert by["energy_scale"]["size"] == {"range": [3.0, 5.0], "asymmetric": True}
    # weird: 1/100, 1/200, 0.5/50 -> 1, 0.5, 1 %
    assert by["other"]["size"]["range"] == [0.5, 1.0]
    assert by["other"]["specific"] == "weird"
    assert {c: u["specific"] for c, u in by.items()} == {
        "stat": "stat", "lumi": "Luminosity", "energy_scale": "JES", "other": "weird"}
    assert by["stat"]["full_table"] == REF
    assert by["stat"]["provenance"]["ref"] == REF
    assert by["stat"]["provenance"]["locator"] == "Table 5, error 'stat'"
    assert by["stat"]["provenance"]["source"] == "hepdata"
    assert by["stat"]["provenance"]["status"] == "machine-verified"
    assert "uid" not in by["stat"]["provenance"]


def test_summarize_skips_zero_value_bins():
    t = {"dependent_variables": [{"values": [
        {"value": 0, "errors": [{"label": "stat", "symerror": 1.0}]},
        {"value": 10.0, "errors": [{"label": "stat", "symerror": 1.0}]}]}]}
    (u,) = hepdata.summarize(t, LABEL_MAP, REF)
    assert u["size"]["range"] == [10.0, 10.0]


def test_total_pct_quadrature():
    # bin 3 (1-based): stat 2%, lumi 2.46%, JES 3%, weird 1% -> sqrt(4 + 6.0516 + 9 + 1)
    assert hepdata.total_pct(TABLE, 3) == pytest.approx((4 + 2.46**2 + 9 + 1) ** 0.5)
    # bin 1: 2, 2.46, 5, 1 ; bin 2: 3, 2.46, 4, 0.5 ; minimum over bins is bin 3 (4.48) < bin 2 (5.6)
    assert hepdata.total_pct(TABLE, None) == pytest.approx((4 + 2.46**2 + 9 + 1) ** 0.5)


ZERO_FIRST = {"dependent_variables": [{"values": [
    {"value": 0, "errors": [{"label": "stat", "symerror": 1.0}]},
    {"value": 10.0, "errors": [{"label": "stat", "symerror": 1.0}]},
    {"value": 20.0, "errors": [{"label": "stat", "symerror": 1.0}]}]}]}


def test_total_pct_keeps_original_bin_numbering():
    assert hepdata.total_pct(ZERO_FIRST, 2) == pytest.approx(10.0)
    assert hepdata.total_pct(ZERO_FIRST, 3) == pytest.approx(5.0)
    assert hepdata.total_pct(ZERO_FIRST, None) == pytest.approx(5.0)


@pytest.mark.parametrize("b", [0, -1, 4])
def test_total_pct_out_of_range(b):
    with pytest.raises(ValueError, match="out of range"):
        hepdata.total_pct(ZERO_FIRST, b)


def test_total_pct_zero_bin_and_all_zero():
    with pytest.raises(ValueError, match="value 0"):
        hepdata.total_pct(ZERO_FIRST, 1)
    with pytest.raises(ValueError, match="no non-zero"):
        hepdata.total_pct({"dependent_variables": [{"values": [{"value": 0, "errors": []}]}]}, None)


def test_asymerror_percent_strings():
    t = {"dependent_variables": [{"values": [
        {"value": 10.0, "errors": [{"label": "JES", "asymerror": {"plus": "+3.2%", "minus": "-1.1%"}}]}]}]}
    (u,) = hepdata.summarize(t, LABEL_MAP, REF)
    assert u["size"] == {"range": [3.2, 3.2], "asymmetric": True}


def test_ingest_prints_results_snippet(capsys):
    assert ingest_hepdata.main(["ins1234567", "Table 5", "--bin", "3"], fetch=lambda u: (FIX / "hepdata" / "table.yaml").read_text()) == 0
    (r,) = YAML(typ="safe").load(capsys.readouterr().out)["results"]
    assert r["measurement"] == "<MEAS-ID>"
    assert r["total"]["value_pct"] == 4.5
    assert r["total"]["provenance"]["source"] == "hepdata"
    assert r["total"]["provenance"]["status"] == "machine-verified"
    assert r["total"]["provenance"]["ref"] == REF
    assert [u["category"] for u in r["uncertainties"]] == ["stat", "lumi", "energy_scale", "other"]


def test_fetch_table_url_and_parse():
    urls = []

    def fetch(url):
        urls.append(url)
        return (FIX / "hepdata" / "table.yaml").read_text()

    t = hepdata.fetch_table(1234567, "Table 5", fetch=fetch)
    assert urls == ["https://www.hepdata.net/download/table/ins1234567/Table%205/1/yaml"]
    assert len(t["dependent_variables"][0]["values"]) == 3


@pytest.mark.parametrize("status,code", [(200, 0), (404, 1)])
def test_linkcheck_exit_code(status, code, capsys):
    urls = []

    def head(url):
        urls.append(url)
        return status

    assert linkcheck.main(["--root", str(FIX / "repo_min")], head=head, sleep=lambda s: None) == code
    assert any(u.startswith("https://arxiv.org/abs/") for u in urls)
    assert "https://www.hepdata.net/download/table/ins1000001/Table%201/1/yaml" in urls
    assert any(u.startswith("https://inspirehep.net/") for u in urls)
    if code:
        assert "404" in capsys.readouterr().out


def test_curl_get_and_status_use_curl_without_user_agent():
    from types import SimpleNamespace
    calls = []

    def run(cmd, **kw):
        calls.append(cmd)
        return SimpleNamespace(returncode=0, stdout="200" if "-I" in cmd else "yaml: body", stderr="")

    assert hepdata.curl_get("https://www.hepdata.net/x", run=run) == "yaml: body"
    assert hepdata.curl_status("https://www.hepdata.net/x", run=run) == 200
    assert all(c[0] == "curl" and "https://www.hepdata.net/x" in c for c in calls)
    assert not any("agent" in a.lower() or a == "-A" for c in calls for a in c)


def test_curl_get_raises_on_failure():
    from types import SimpleNamespace
    run = lambda cmd, **kw: SimpleNamespace(returncode=22, stdout="", stderr="403")  # noqa: E731
    with pytest.raises(OSError, match="403"):
        hepdata.curl_get("https://www.hepdata.net/x", run=run)
