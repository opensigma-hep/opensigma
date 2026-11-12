from copy import deepcopy
from datetime import date
from pathlib import Path

from scripts import linkcheck
from scripts.opensigma.derive import derive
from scripts.opensigma.load import load_repo
from scripts.opensigma.validate import validate, validate_integrity, validate_schema

ROOT = Path(__file__).parent
MIN = ROOT / "fixtures" / "repo_min"
DATA = ROOT.parent / "data"
SCHEMA = DATA / "schema"

EXP = {"id": "exp:atlas", "name": "ATLAS", "kind": "experiment", "colliders": ["col:lhc-13"], "description": "d",
       "links": [{"label": "Home", "url": "https://atlas.cern/"}], "sources": ["https://home.cern/x"]}
GRP = {"id": "grp:pdg", "name": "PDG", "description": "d", "links": [{"label": "Home", "url": "https://pdg.lbl.gov/"}]}


def _repo(**exp):
    """Min fixture with a registry holding one experiment named after the fixture's first measurement."""
    repo = deepcopy(load_repo(MIN))
    meas = repo["processes"][0]["channels"][0]["measurements"][0]
    repo["experiments"] = [{**EXP, "name": meas["experiment"], **exp}]
    repo["groups"] = [deepcopy(GRP)]
    return repo, meas


def test_no_registry_file_loads_empty_and_checks_nothing():
    repo = load_repo(MIN)
    assert repo["experiments"] == [] and repo["groups"] == []
    assert validate(repo, SCHEMA) == []


def test_seed_registry_loads_and_is_schema_valid():
    repo = load_repo(DATA)
    names = {e["name"] for e in repo["experiments"]}
    assert {"ATLAS", "CMS", "combination"} <= names and len(names) == len(repo["experiments"])
    assert repo["groups"]
    assert [i for i in validate_schema(repo, SCHEMA) if i.file in ("experiments.yaml", "colliders.yaml")] == []


def test_seed_registry_ids_and_colliders_resolve():
    errors = [i for i in validate_integrity(load_repo(DATA)) if i.level == "error" and i.file == "experiments.yaml"]
    assert errors == []


def test_registered_experiment_is_clean():
    repo, _ = _repo()
    assert validate(repo, SCHEMA) == []


def test_unregistered_experiment_is_a_warning_not_an_error():
    repo, meas = _repo()
    meas["experiment"] = "GHOST"
    issues = [i for i in validate(repo, SCHEMA) if "GHOST" in i.msg]
    assert [i.level for i in issues] == ["warning"]
    assert issues[0].file == repo["processes"][0]["_file"] and meas["id"] in issues[0].path


def test_experiment_collider_must_exist():
    repo, _ = _repo(colliders=["col:ghost"])
    (e,) = [i for i in validate_integrity(repo) if i.level == "error"]
    assert e.file == "experiments.yaml" and "col:ghost" in e.msg


def test_experiment_id_shares_the_id_namespace():
    repo, _ = _repo()
    repo["groups"][0]["id"] = repo["experiments"][0]["id"]
    assert any("already claimed" in i.msg for i in validate_integrity(repo))


def test_schema_rejects_bad_registry_entries():
    for bad in ({"id": "col:atlas"}, {"kind": "detector"}, {"links": [{"label": "x", "url": "http://insecure.example/"}]},
                {"links": [{"label": "x", "url": "javascript:alert(1)"}]}, {"sources": ["not a url"]}, {"extra": 1}):
        repo, _ = _repo(**bad)
        assert any(i.file == "experiments.yaml" for i in validate_schema(repo, SCHEMA)), bad


def test_collider_optional_facts_schema():
    repo = deepcopy(load_repo(MIN))
    repo["colliders"][0].update(lab="Fermilab", years="1985–2011", url="https://www.fnal.gov/pub/tevatron/",
                                luminosity={"text": "x", "source": "https://www.fnal.gov/"})
    assert validate_schema(repo, SCHEMA) == []
    repo["colliders"][0]["luminosity"] = {"text": "a number without a source"}
    assert any("'source' is a required property" in i.msg for i in validate_schema(repo, SCHEMA))


def test_experiments_are_searchable():
    repo, _ = _repo(full_name="A Full Name")
    (hit,) = [e for e in derive(repo, date(2026, 11, 12))["search_index"] if e["kind"] == "exp"]
    assert hit["id"] == "exp:atlas" and "A Full Name" in hit["text"]


def test_linkcheck_covers_registry_urls(capsys):
    repo, _ = _repo()
    repo["colliders"][0].update(url="https://lab.example/machine", luminosity={"text": "x", "source": "https://lab.example/lumi"})
    assert linkcheck.registry_urls(repo) == {"https://atlas.cern/", "https://home.cern/x", "https://pdg.lbl.gov/",
                                             "https://lab.example/machine", "https://lab.example/lumi"}
    seen = []
    assert linkcheck.main(["--root", str(DATA), "--registry"], head=lambda u: seen.append(u) or 200, sleep=lambda s: None) == 0
    assert "https://www.hepdata.net/search/?collaboration=ATLAS" in seen
    assert not any(u.startswith("https://arxiv.org/") for u in seen)
