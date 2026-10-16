import json
import shutil
from pathlib import Path

from scripts import contributors
from scripts.opensigma.load import load_repo

MIN = Path(__file__).parent / "fixtures" / "repo_min"
DY = "processes/vector-bosons/dy-nc.yaml"
ROOT = Path(__file__).parent.parent


def _repo(tmp_path, verifiers=(), maintainers=()):
    root = tmp_path / "repo"
    shutil.copytree(MIN, root)
    f = root / DY
    t = f.read_text(encoding="utf-8")
    for uid, who in zip(("a1b2c3d4", "b2c3d4e5", "c3d4e5f6"), verifiers):
        t = t.replace(f'uid: "{uid}", ', f'uid: "{uid}", verified_by: {who}, ', 1)
    f.write_text(t, encoding="utf-8")
    fam = root / "families.yaml"
    fam.write_text(fam.read_text(encoding="utf-8").replace("maintainers: []", f"maintainers: {list(maintainers)}".replace("'", '"'), 1), encoding="utf-8")
    return load_repo(root)


def test_contributors_unique_sorted_includes_maintainers(tmp_path):
    repo = _repo(tmp_path, verifiers=("zed", "alice", "zed"), maintainers=("bob", "alice"))
    assert contributors.zenodo_contributors(repo) == [{"name": n, "type": "DataCurator"} for n in ("alice", "bob", "zed")]


def test_no_contributors_yet(tmp_path):
    assert contributors.zenodo_contributors(_repo(tmp_path)) == []


def test_main_writes_zenodo_json_from_citation(tmp_path):
    out = tmp_path / ".zenodo.json"
    assert contributors.main(["--root", str(MIN), "--citation", str(ROOT / "CITATION.cff"), "--out", str(out)]) == 0
    z = json.loads(out.read_text(encoding="utf-8"))
    assert z["upload_type"] == "dataset" and z["license"] == "CC-BY-4.0"
    assert z["creators"][0] == {"name": "Gambuti, Giulio", "affiliation": "ETH Zürich"}
    assert z["creators"][1]["name"] == "OpenSigma contributors"
    assert z["contributors"] == []
    assert (ROOT / ".zenodo.json").read_text(encoding="utf-8") == out.read_text(encoding="utf-8")  # committed file is current
