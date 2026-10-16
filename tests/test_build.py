import json
import shutil
from pathlib import Path

from scripts import build, validate

MIN = Path(__file__).parent / "fixtures" / "repo_min"


def _has_key(x, key):
    if isinstance(x, dict):
        return key in x or any(_has_key(v, key) for v in x.values())
    return isinstance(x, list) and any(_has_key(v, key) for v in x)


def test_build_min_fixture_writes_json(tmp_path):
    out = tmp_path / "data.json"
    assert build.main(["--root", str(MIN), "--out", str(out), "--offline", "--today", "2026-10-16"]) == 0
    d = json.loads(out.read_text(encoding="utf-8"))
    assert d["derived"]["cells"]["chan:dy-nc/lhc-13"]["max_qcd"] == "NNLO"
    assert d["build"]["date"] == "2026-10-16"
    assert not _has_key(d, "_file")


def test_build_fails_on_dangling(tmp_path, capsys):
    root = tmp_path / "repo"
    shutil.copytree(MIN, root)
    f = root / "processes" / "vector-bosons" / "dy-nc.yaml"
    f.write_text(f.read_text(encoding="utf-8").replace('uses_amplitudes: ["amp:2L/0-qqbarV"]', 'uses_amplitudes: ["amp:nope"]'), encoding="utf-8")
    out = tmp_path / "data.json"
    assert build.main(["--root", str(root), "--out", str(out), "--offline"]) == 1
    assert "processes/vector-bosons/dy-nc.yaml" in capsys.readouterr().out
    assert not out.exists()


def test_check_does_not_write(tmp_path):
    out = tmp_path / "data.json"
    assert build.main(["--root", str(MIN), "--out", str(out), "--offline", "--check"]) == 0
    assert not out.exists()


def test_unresolved_ref_fails(tmp_path, capsys):
    root = tmp_path / "repo"
    shutil.copytree(MIN, root)
    (root / "refs.json").unlink()
    assert build.main(["--root", str(root), "--out", str(tmp_path / "d.json"), "--offline"]) == 1
    assert "ERROR unresolved ref inspire:" in capsys.readouterr().out


def test_validate_entry_point():
    assert validate.main(["--root", str(MIN)]) == 0
