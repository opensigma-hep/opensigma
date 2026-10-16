import re
import shutil
from pathlib import Path

from scripts.assign_uids import assign_missing

MIN = Path(__file__).parent / "fixtures" / "repo_min"
DY = "processes/vector-bosons/dy-nc.yaml"


def _stripped(tmp_path):
    root = tmp_path / "repo"
    shutil.copytree(MIN, root)
    f = root / DY
    text = f.read_text(encoding="utf-8")
    text = text.replace('uid: "a1b2c3d4", ', "", 1).replace("channels:", "# keep me\nchannels:", 1)
    f.write_text(text, encoding="utf-8")
    return root, f


def test_assigns_and_preserves_comments(tmp_path):
    root, f = _stripped(tmp_path)
    assert assign_missing(root) == 1
    text = f.read_text(encoding="utf-8")
    assert "# keep me" in text
    m = re.search(r"provenance: \{uid: ([^,]+), ref: \"inspire:1000003\", locator: \"Sec. 3\"", text)
    assert m and re.fullmatch(r"[0-9a-f]{8}", m.group(1).strip("\"'"))


def test_idempotent(tmp_path):
    root, f = _stripped(tmp_path)
    assert assign_missing(root) == 1
    before = f.read_text(encoding="utf-8")
    assert assign_missing(root) == 0
    assert f.read_text(encoding="utf-8") == before
