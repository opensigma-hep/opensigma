import pytest
from ruamel.yaml import YAML

from pathlib import Path

from scripts import linkcheck
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
    assert any(u.startswith("https://inspirehep.net/") for u in urls)
    if code:
        assert "404" in capsys.readouterr().out
