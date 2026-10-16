import json
import shutil
from pathlib import Path

import pytest

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


def _release(tmp_path, with_file):
    root = tmp_path / "repo"
    shutil.copytree(MIN, root)
    if with_file:
        (root / "release.yaml").write_text('{version: "v2026.10", doi: "10.5281/zenodo.2", concept_doi: "10.5281/zenodo.1"}\n', encoding="utf-8")
    out = tmp_path / "data.json"
    assert build.main(["--root", str(root), "--out", str(out), "--offline"]) == 0
    return json.loads(out.read_text(encoding="utf-8"))["build"]["release"]


def test_build_release_from_release_yaml(tmp_path):
    assert _release(tmp_path, True) == {"version": "v2026.10", "doi": "10.5281/zenodo.2", "concept_doi": "10.5281/zenodo.1"}


def test_build_release_null_when_unreleased(tmp_path):
    assert _release(tmp_path, False) is None


def test_integrity_error_path_not_letter_split(tmp_path, capsys):
    root = tmp_path / "repo"
    shutil.copytree(MIN, root)
    f = root / "processes" / "vector-bosons" / "dy-nc.yaml"
    f.write_text(f.read_text(encoding="utf-8").replace('uses_amplitudes: ["amp:2L/0-qqbarV"]', 'uses_amplitudes: ["amp:nope"]'), encoding="utf-8")
    build.main(["--root", str(root), "--out", str(tmp_path / "d.json"), "--offline"])
    out = capsys.readouterr().out
    assert "u/s/e/s" not in out and "/uses_amplitudes:" in out


def test_build_with_unquoted_yaml_date(tmp_path):
    root = tmp_path / "repo"
    shutil.copytree(MIN, root)
    f = root / "processes" / "vector-bosons" / "dy-nc.yaml"
    f.write_text(f.read_text(encoding="utf-8").replace('last_reviewed: "2026-10-01"', "last_reviewed: 2026-10-01"), encoding="utf-8")
    out = tmp_path / "data.json"
    assert build.main(["--root", str(root), "--out", str(out), "--offline", "--today", "2026-10-16"]) == 0
    chan = json.loads(out.read_text(encoding="utf-8"))["processes"][0]["channels"][0]
    assert chan["last_reviewed"] == "2026-10-01"


def test_build_rejects_malformed_release(tmp_path, capsys):
    root = tmp_path / "repo"
    shutil.copytree(MIN, root)
    (root / "release.yaml").write_text('{version: "v2026.10", concept_doi: "10.5281/zenodo.1"}\n', encoding="utf-8")
    assert build.main(["--root", str(root), "--out", str(tmp_path / "d.json"), "--offline"]) == 1
    assert "ERROR release.yaml: doi must be a bare DOI" in capsys.readouterr().out


@pytest.mark.parametrize("text,msg", [
    ("", "processes/vector-bosons/dy-nc.yaml: empty file"),
    ("id: [unclosed\n", "processes/vector-bosons/dy-nc.yaml: invalid YAML at line 2"),
    ("- a\n", "processes/vector-bosons/dy-nc.yaml: expected a YAML mapping, got list"),
])
def test_bad_yaml_is_one_error_line(tmp_path, capsys, text, msg):
    root = tmp_path / "repo"
    shutil.copytree(MIN, root)
    (root / "processes" / "vector-bosons" / "dy-nc.yaml").write_text(text, encoding="utf-8")
    assert build.main(["--root", str(root), "--out", str(tmp_path / "d.json"), "--offline"]) == 1
    assert capsys.readouterr().out.startswith(f"ERROR {msg}")
