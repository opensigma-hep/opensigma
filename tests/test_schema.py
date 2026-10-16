from pathlib import Path

import pytest
from ruamel.yaml import YAML

from scripts.opensigma.load import load_repo
from scripts.opensigma.validate import validate_schema

ROOT = Path(__file__).parent
MIN = ROOT / "fixtures" / "repo_min"
BAD = ROOT / "fixtures" / "bad"
SCHEMA = ROOT.parent / "data" / "schema"
DY = "processes/vector-bosons/dy-nc.yaml"


def _errors(proc: dict, name: str = "bad.yaml") -> list[str]:
    repo = load_repo(MIN)
    repo["processes"] = [{**proc, "_file": name}]
    return [i.msg for i in validate_schema(repo, SCHEMA) if i.level == "error"]


def _bad(name: str) -> dict:
    return YAML(typ="safe").load((BAD / name).read_text(encoding="utf-8"))


def test_min_fixture_valid():
    assert validate_schema(load_repo(MIN), SCHEMA) == []


def test_seed_data_valid():
    assert validate_schema(load_repo(ROOT.parent / "data"), SCHEMA) == []


@pytest.mark.parametrize("fixture, expected", [
    ("no-locator.yaml", "'locator' is a required property"),
    ("mhou-no-method.yaml", "'method' is a required property"),
    ("pdf-no-pdf-set.yaml", "'pdf_set' is a required property"),
    ("bad-category.yaml", "'scale' is not one of"),
    ("projected-no-source.yaml", "'projection_source' is a required property"),
    ("sector-bsm.yaml", "'SM' was expected"),
])
def test_bad_fixture_rejected(fixture, expected):
    assert any(expected in m for m in _errors(_bad(fixture)))


def test_issue_carries_file_and_path():
    repo = load_repo(MIN)
    repo["processes"] = [{**_bad("no-locator.yaml"), "_file": "processes/x/bad.yaml"}]
    (issue,) = validate_schema(repo, SCHEMA)
    assert issue.file == "processes/x/bad.yaml"
    assert issue.path == "channels/0/observables/0/results/0/total/provenance"


@pytest.mark.parametrize("value, ok", [
    ("±0.4", True), ("+3.1/−5.0", True), ("+3.1/-5.0", True),
    ("about 3%", False), ("0.4", False), ("+3.1/5.0", False),
])
def test_region_value(value, ok):
    proc = _bad("bad-region.yaml")
    proc["channels"][0]["observables"][0]["results"][0]["uncertainties"][0]["size"]["regions"][0]["value"] = value
    assert (_errors(proc) == []) is ok
    if not ok:
        assert any("does not match" in m for m in _errors(proc))


def test_unquoted_dates_accepted():
    from datetime import date
    proc = _bad("no-locator.yaml")
    proc["channels"][0]["last_reviewed"] = date(2026, 10, 1)
    assert not any("last_reviewed" in m or "date" in m for m in _errors(proc))


@pytest.mark.parametrize("field, bad, good", [
    ("issue", "javascript:alert(1)", "https://github.com/opensigma-hep/opensigma/issues/3"),
    ("issues", ["javascript:alert(1)"], ["https://github.com/opensigma-hep/opensigma/issues/3"]),
])
def test_provenance_issue_links_must_be_github(field, bad, good):
    proc = load_repo(MIN)["processes"][0]
    prov = proc["channels"][0]["observables"][0]["results"][0]["total"]["provenance"]
    for value, ok in [(bad, False), (good, True)]:
        prov[field] = value
        assert (_errors(proc, DY) == []) is ok
