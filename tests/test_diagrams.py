from copy import deepcopy
from pathlib import Path

import pytest

from scripts.opensigma.load import load_repo
from scripts.opensigma.validate import validate, validate_integrity, validate_schema

ROOT = Path(__file__).parent
MIN = ROOT / "fixtures" / "repo_min"
DATA = ROOT.parent / "data"
SCHEMA = DATA / "schema"

DY = {
    "title": "q q̄ → Z/γ* → ℓ⁺ℓ⁻",
    "points": {"i1": [0, 0.5], "i2": [0, 2.5], "a": [1.2, 1.5], "b": [2.8, 1.5], "o1": [4, 0.5], "o2": [4, 2.5]},
    "edges": [
        {"from": "i1", "to": "a", "type": "fermion", "label": "q"},
        {"from": "i2", "to": "a", "type": "antifermion", "label": "q̄"},
        {"from": "a", "to": "b", "type": "boson", "label": "Z/γ*"},
        {"from": "b", "to": "o1", "type": "fermion", "label": "ℓ⁻"},
        {"from": "b", "to": "o2", "type": "antifermion", "label": "ℓ⁺", "flip": True},
    ],
}


def _repo(diagram=None, key="proc:dy-nc"):
    repo = load_repo(MIN)
    repo["diagrams"] = {key: deepcopy(DY) if diagram is None else diagram}
    return repo


def _schema_errors(repo):
    return [i for i in validate_schema(repo, SCHEMA) if i.file == "diagrams.yaml"]


def test_missing_file_gives_no_diagrams():
    assert load_repo(MIN)["diagrams"] == {}


def test_valid_diagram_passes():
    assert validate(_repo(), SCHEMA) == []


def _mutated(fn):
    d = deepcopy(DY)
    fn(d)
    return d


@pytest.mark.parametrize("mutate, expected", [
    (lambda d: d["edges"][0].update(type="graviton"), "'graviton' is not one of"),
    (lambda d: d.pop("title"), "'title' is a required property"),
    (lambda d: d["points"].update(a=[5, 1]), "greater than the maximum"),
    (lambda d: d["points"].update(a=[1, 1, 1]), "at most 2 items"),
    (lambda d: d["edges"][0].pop("to"), "'to' is a required property"),
    (lambda d: d["edges"][0].update(colour="red"), "Additional properties"),
    (lambda d: d.update(edges=[]), "[]"),
])
def test_schema_rejects(mutate, expected):
    errors = _schema_errors(_repo(_mutated(mutate)))
    assert errors and any(expected in e.msg for e in errors)


def test_schema_rejects_non_process_key():
    assert _schema_errors(_repo(key="fam:top"))


def test_integrity_unknown_process():
    (e,) = [i for i in validate_integrity(_repo(key="proc:ghost")) if i.level == "error"]
    assert e.file == "diagrams.yaml" and "proc:ghost" in e.msg


def test_integrity_undeclared_point():
    (e,) = [i for i in validate_integrity(_repo(_mutated(lambda d: d["edges"][2].update(to="zz")))) if i.level == "error"]
    assert e.path == "proc:dy-nc/edges/2/to" and "'zz'" in e.msg


def test_integrity_self_loop():
    (e,) = [i for i in validate_integrity(_repo(_mutated(lambda d: d["edges"][2].update(to="a")))) if i.level == "error"]
    assert "itself" in e.msg


def test_process_without_diagram_is_fine():
    repo = load_repo(MIN)
    assert repo["processes"] and validate(repo, SCHEMA) == []


def test_real_diagrams_valid():
    repo = load_repo(DATA)
    assert repo["diagrams"], "data/diagrams.yaml is missing or empty"
    assert _schema_errors(repo) == []
    assert [i for i in validate_integrity(repo) if i.file == "diagrams.yaml"] == []


def test_real_diagrams_fermion_flow():
    """At every vertex with fermion lines, as many arrows enter as leave (fermion number is conserved)."""
    for pid, d in load_repo(DATA)["diagrams"].items():
        net, degree = {}, {}
        for e in d["edges"]:
            for end in (e["from"], e["to"]):
                degree[end] = degree.get(end, 0) + 1
            if e["type"] in ("fermion", "antifermion", "ghost"):
                src, dst = (e["from"], e["to"]) if e["type"] != "antifermion" else (e["to"], e["from"])
                net[src] = net.get(src, 0) - 1
                net[dst] = net.get(dst, 0) + 1
        bad = [v for v, n in net.items() if n and degree[v] > 1]
        assert not bad, f"{pid}: fermion flow not conserved at {bad}"
