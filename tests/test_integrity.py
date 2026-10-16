from copy import deepcopy
from pathlib import Path

import pytest

from scripts.phenomap.load import load_repo
from scripts.phenomap.validate import validate, validate_integrity

ROOT = Path(__file__).parent
MIN = ROOT / "fixtures" / "repo_min"
SCHEMA = ROOT.parent / "data" / "schema"
DY = "processes/vector-bosons/dy-nc.yaml"


def _repo():
    repo = deepcopy(load_repo(MIN))
    return repo, repo["processes"][0], repo["processes"][0]["channels"][0]["observables"][0]


def _errors(repo):
    return [i for i in validate_integrity(repo) if i.level == "error"]


def _one(repo, text):
    (e,) = _errors(repo)
    assert text in e.msg
    return e


def test_min_fixture_clean():
    assert validate(load_repo(MIN), SCHEMA) == []


def test_dangling_compared_to():
    repo, _, obs = _repo()
    obs["predictions"][0]["compared_to"] = ["meas:dy-nc/lhc-13/ghost"]
    e = _one(repo, "meas:dy-nc/lhc-13/ghost")
    assert DY in e.msg and e.file == DY


def test_dangling_uses_amplitudes():
    repo, _, obs = _repo()
    obs["predictions"][0]["uses_amplitudes"] = ["amp:ghost"]
    _one(repo, "amp:ghost")


def test_dangling_superseded_by():
    repo, proc, _ = _repo()
    proc["channels"][0]["measurements"][0]["superseded_by"] = "meas:ghost"
    _one(repo, "meas:ghost")


def test_dangling_headline_observable():
    repo, proc, _ = _repo()
    proc["channels"][0]["headline"]["observable"] = "obs:ghost"
    _one(repo, "obs:ghost")


def test_unknown_also_in_family():
    repo, proc, _ = _repo()
    proc["also_in"] = ["fam:ghost"]
    _one(repo, "fam:ghost")


def test_unknown_collider():
    repo, proc, _ = _repo()
    proc["channels"][0]["collider"] = "col:ghost"
    _one(repo, "col:ghost")


def test_alias_is_not_a_valid_reference_target():
    repo, proc, obs = _repo()
    proc["channels"][0]["measurements"][0]["aliases"] = ["meas:old"]
    obs["predictions"][0]["compared_to"] = ["meas:old"]
    _one(repo, "meas:old")


def test_duplicate_uid():
    repo, proc, obs = _repo()
    obs["results"][0]["total"]["provenance"]["uid"] = obs["predictions"][0]["provenance"]["uid"]
    _one(repo, "duplicate provenance uid")


def test_duplicate_id_across_files():
    repo, _, _ = _repo()
    repo["amplitudes"][0]["id"] = "proc:dy-nc"
    e = next(e for e in _errors(repo) if "already claimed" in e.msg)  # dangling amp refs follow too
    assert e.file == "amplitudes/2L-0-qqbarV.yaml"


@pytest.mark.parametrize("alias", ["proc:dy-nc", "par:old"])
def test_alias_collides_with_id_or_alias(alias):
    repo, _, _ = _repo()
    repo["parameters"][0]["aliases"] = ["par:old"]
    repo["processes"][0]["aliases"] = [alias]
    _one(repo, "already claimed")


def test_process_family_folder_matches():
    repo, proc, _ = _repo()
    proc["family"] = "fam:top"
    _one(repo, "does not match family")


def test_more_than_one_headline_prediction_per_observable():
    repo, _, obs = _repo()
    obs["predictions"].append({"label": "other", "headline": True})
    _one(repo, "2 headline predictions")


def test_other_category_is_warning():
    repo, _, obs = _repo()
    obs["results"][0]["uncertainties"][0]["category"] = "other"
    issues = validate_integrity(repo)
    assert [i.level for i in issues] == ["warning"]


def test_integrity_skipped_on_schema_errors():
    repo, proc, _ = _repo()
    proc["sector"] = "BSM"
    proc["also_in"] = ["fam:ghost"]
    assert all("ghost" not in i.msg for i in validate(repo, SCHEMA))
