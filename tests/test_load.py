import shutil
from pathlib import Path

from scripts.opensigma.load import load_repo

FIXTURE = Path(__file__).parent / "fixtures" / "repo_min"


def test_load_min_fixture():
    repo = load_repo(FIXTURE)
    assert [f["id"] for f in repo["families"]][:2] == ["fam:vector-bosons", "fam:top"]
    assert repo["processes"][0]["id"] == "proc:dy-nc"
    assert repo["processes"][0]["_file"] == "processes/vector-bosons/dy-nc.yaml"
    assert repo["amplitudes"][0]["_file"] == "amplitudes/2L-0-qqbarV.yaml"
    assert repo["parameters"][0]["_file"] == "parameters/mw.yaml"
    assert isinstance(repo["refs"], dict) and repo["refs"]
    assert repo["candidates"] == {}


def test_missing_optional_files_give_empty(tmp_path):
    tmp = tmp_path / "repo"
    shutil.copytree(FIXTURE, tmp)
    (tmp / "refs.json").unlink()
    repo = load_repo(tmp)
    assert repo["refs"] == {} and repo["candidates"] == {}
