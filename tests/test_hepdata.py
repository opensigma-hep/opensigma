import json

import pytest
from ruamel.yaml import YAML

from pathlib import Path

from scripts import ingest_hepdata, linkcheck, machine_verify
from scripts.opensigma import hepdata

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


@pytest.mark.parametrize("status,code", [(200, 0), (404, 1), (429, 0)])
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
        return SimpleNamespace(returncode=0, stdout="200 application/yaml" if "-I" in cmd else "yaml: body", stderr="")

    assert hepdata.curl_get("https://www.hepdata.net/x", run=run) == "yaml: body"
    assert hepdata.curl_status("https://www.hepdata.net/x", run=run) == 200
    assert all(c[0] == "curl" and "https://www.hepdata.net/x" in c for c in calls)
    assert not any("agent" in a.lower() or a == "-A" for c in calls for a in c)


@pytest.mark.parametrize("url,out,status", [
    ("https://www.hepdata.net/download/table/ins1/Nope/1/yaml", "200 text/html; charset=utf-8", 404),
    ("https://www.hepdata.net/record/ins1", "200 text/html; charset=utf-8", 200),
    ("https://www.hepdata.net/x", "", 0),
])
def test_curl_status_html_for_yaml_download_is_404(url, out, status):
    from types import SimpleNamespace
    assert hepdata.curl_status(url, run=lambda cmd, **kw: SimpleNamespace(returncode=0, stdout=out, stderr="")) == status


@pytest.mark.parametrize("body", ["<!DOCTYPE html>\n<html lang=\"en\">\n  <head>\n", "<html><body>Not found</body></html>"])
def test_fetch_table_rejects_html(body):
    with pytest.raises(ValueError, match="not a HEPData YAML table"):
        hepdata.fetch_table(1, "Nope", fetch=lambda url: body)


def test_curl_get_raises_on_failure():
    from types import SimpleNamespace
    run = lambda cmd, **kw: SimpleNamespace(returncode=22, stdout="", stderr="403")  # noqa: E731
    with pytest.raises(OSError, match="403"):
        hepdata.curl_get("https://www.hepdata.net/x", run=run)


def test_total_column_is_used_not_double_counted():
    t = {"dependent_variables": [{"values": [{"value": 10.0, "errors": [
        {"label": "Total uncertainty", "symerror": 0.68}, {"label": "Syst. uncertainty", "symerror": 0.5}]}]}]}
    assert hepdata.total_pct(t, 1) == pytest.approx(6.8)
    assert [u["specific"] for u in hepdata.summarize(t, LABEL_MAP, REF)] == ["Syst. uncertainty"]
    s = {"dependent_variables": [{"values": [{"value": 1.0, "errors": [{"label": "Stat.+Syst.", "symerror": 0.1}]}]}]}
    assert hepdata.total_pct(s, 1) == pytest.approx(10.0) and hepdata.summarize(s, LABEL_MAP, REF) == []


def test_unlabelled_error_does_not_crash():
    t = {"dependent_variables": [{"values": [{"value": 2.0, "errors": [{"symerror": 0.2}]}]}]}
    assert hepdata.total_pct(t, 1) == pytest.approx(10.0)
    assert hepdata.summarize(t, LABEL_MAP, REF)[0]["specific"] == "error"


def test_string_values_do_not_crash():  # e.g. ATLAS WZ ins1720438 "Table 6"
    t = {"dependent_variables": [{"values": [{"value": "51.0", "errors": [
        {"label": "stat", "symerror": "0.8"}, {"label": "sys", "symerror": "1.8"}]}, {"value": "0", "errors": []}]}]}
    assert hepdata.total_pct(t, 1) == pytest.approx((0.8**2 + 1.8**2) ** 0.5 / 51 * 100)
    assert [u["size"]["range"] for u in hepdata.summarize(t, LABEL_MAP, REF)] == [[1.6, 1.6], [3.5, 3.5]]


# First column a theory prediction, second the measurement (e.g. CMS WZ ins1949191 "Total cross sections").
COLS = {"dependent_variables": [
    {"values": [{"value": 50.0, "errors": [{"label": "scale", "symerror": 1.0}]}]},
    {"values": [{"value": 50.0, "errors": [{"label": "stat", "symerror": 2.5}]}]}]}


def test_column_selects_dependent_variable():
    assert hepdata.total_pct(COLS, None) == pytest.approx(2.0)
    assert hepdata.total_pct(COLS, None, 2) == pytest.approx(5.0)
    (u,) = hepdata.summarize(COLS, LABEL_MAP, REF, column=2)
    assert u["specific"] == "stat" and u["provenance"]["locator"] == "Table 5, column 2, error 'stat'"
    with pytest.raises(ValueError, match="column 3 out of range"):
        hepdata.total_pct(COLS, None, 3)


def test_ingest_column_round_trips_through_machine_verify(capsys):
    assert ingest_hepdata.main(["ins1234567", "Table 5", "--column", "2"], fetch=lambda u: json.dumps(COLS)) == 0
    (r,) = YAML(typ="safe").load(capsys.readouterr().out)["results"]
    assert r["total"]["value_pct"] == 5.0 and ", column 2," in r["total"]["provenance"]["locator"]
    assert all(ok for *_, ok in machine_verify._items(r, lambda ref: COLS, LABEL_MAP))


def test_ingest_total_only_column(capsys):
    t = {"dependent_variables": [{"values": [{"value": 4.0, "errors": [{"label": "Total", "symerror": 0.2}]}]}]}
    assert ingest_hepdata.main(["ins1234567", "Table 5"], fetch=lambda u: json.dumps(t)) == 0
    (r,) = YAML(typ="safe").load(capsys.readouterr().out)["results"]
    assert r["total"]["value_pct"] == 5.0 and r["uncertainties"] == [] and r["total"]["provenance"]["ref"] == REF


def test_dash_value_is_an_empty_bin():
    t = {"dependent_variables": [{"values": [{"value": "-"}, {"value": 2.0, "errors": [{"symerror": 0.2}]}]}]}
    assert hepdata.total_pct(t, None) == pytest.approx(10.0)
    with pytest.raises(ValueError, match="bin 1 has value 0"):
        hepdata.total_pct(t, 1)


def test_bins_without_errors_are_not_zero_percent():  # CMS ins1949191 "Total cross sections", column 2
    t = {"dependent_variables": [{"values": [{"value": 53.2}, {"value": 50.0, "errors": [{"symerror": 1.0}]}]}]}
    assert hepdata.total_pct(t, None) == pytest.approx(2.0)
    with pytest.raises(ValueError, match="no errors"):
        hepdata.total_pct(t, 1)
    with pytest.raises(ValueError, match="no non-zero bins with errors"):
        hepdata.total_pct({"dependent_variables": [{"values": [{"value": 53.2}]}]}, None)
