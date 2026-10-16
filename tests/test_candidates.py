import json
import shutil
import urllib.parse
from datetime import date
from pathlib import Path

import pytest

from scripts import build
from scripts.phenomap import candidates
from scripts.phenomap.candidates import find, query_for

MIN = Path(__file__).parent / "fixtures" / "repo_min"
DY = "processes/vector-bosons/dy-nc.yaml"
TODAY = date(2026, 10, 16)
WATCH = 'watch:\n  recids: [1000001]\n  queries: ["t drell-yan"]\n'


def _repo(tmp_path, watch=WATCH):
    root = tmp_path / "repo"
    shutil.copytree(MIN, root)
    f = root / DY
    f.write_text(f.read_text(encoding="utf-8").replace("building_blocks:", "# keep me\n" + watch + "building_blocks:", 1), encoding="utf-8")
    return root


def _hit(recid, title="T", arxiv=None):
    md = {"control_number": recid, "titles": [{"title": title}]}
    if arxiv:
        md["arxiv_eprints"] = [{"value": arxiv}]
    return {"metadata": md}


class FakeFetch:
    def __init__(self, *pages):
        self.pages, self.urls = list(pages), []

    def __call__(self, url):
        self.urls.append(url)
        return self.pages.pop(0)


def _query(url):
    return urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)["q"][0]


def test_query_for_combines_recids_and_queries():
    proc = {"watch": {"recids": [1, 2], "queries": ["t drell-yan and t 13 TeV", "a foo"]}}
    assert query_for(proc, date(2025, 1, 2)) == (
        "(refersto:recid:1 or refersto:recid:2 or (t drell-yan and t 13 TeV) or (a foo)) and de > 2025-01-02"
    )


def test_excludes_already_cited(tmp_path):
    root = _repo(tmp_path)
    # 1000001: inspire/hepdata/arXiv ref, 1000002: inspire ref, 1000003: refs.json entry
    fetch = FakeFetch({"hits": {"hits": [_hit(1000001), _hit(1000002), _hit(1000003), _hit(4242, "New paper", "2601.00042")]}})
    out = find(root, None, fetch, today=TODAY, sleep=lambda s: None)
    q = _query(fetch.urls[0])
    assert q == "(refersto:recid:1000001 or (t drell-yan)) and de > 2021-10-16"  # no last_run: 5 years back
    assert out == {"proc:dy-nc": [{"recid": 4242, "title": "New paper", "arxiv": "2601.00042", "matched_by": q}]}
    assert json.loads((root / "candidates.json").read_text(encoding="utf-8")) == out
    text = (root / DY).read_text(encoding="utf-8")
    assert "# keep me" in text and "last_run: '2026-10-15'" in text  # day before: strict `de >` re-covers today
    assert build.main(["--root", str(root), "--check", "--offline", "--today", "2026-10-16"]) == 0
    # next run re-finds the same paper: merged by recid, no duplicate
    fetch = FakeFetch({"hits": {"hits": [_hit(4242, "New paper", "2601.00042")]}})
    assert find(root, None, fetch, today=TODAY, sleep=lambda s: None) == out
    assert _query(fetch.urls[0]).endswith("and de > 2026-10-15")


def test_merge_keeps_channel_tags(tmp_path):
    root = _repo(tmp_path, WATCH + "  last_run: '2026-01-01'\n")
    old = {
        "proc:dy-nc": [
            {"recid": 4242, "title": "Old", "arxiv": None, "matched_by": "q0", "channels": ["chan:dy-nc/lhc-13"]},
            {"recid": 1000001, "title": "Since cited", "arxiv": None, "matched_by": "q0"},
        ],
        "proc:other": [{"recid": 7, "title": "x", "arxiv": None, "matched_by": "q0"}],
    }
    (root / "candidates.json").write_text(json.dumps(old), encoding="utf-8")
    fetch = FakeFetch({"hits": {"hits": [_hit(4242, "Old"), _hit(5151, "Newer")]}})
    out = find(root, ["proc:dy-nc"], fetch, today=TODAY, sleep=lambda s: None)
    assert _query(fetch.urls[0]).endswith("and de > 2026-01-01")
    assert [(c["recid"], c.get("channels")) for c in out["proc:dy-nc"]] == [(4242, ["chan:dy-nc/lhc-13"]), (5151, None)]
    saved = json.loads((root / "candidates.json").read_text(encoding="utf-8"))
    assert saved["proc:dy-nc"] == out["proc:dy-nc"] and saved["proc:other"] == old["proc:other"]


def test_paginates_dry_run_and_skips_unwatched(tmp_path):
    root = _repo(tmp_path)
    before = (root / DY).read_text(encoding="utf-8")
    fetch = FakeFetch(
        {"hits": {"hits": [_hit(1)]}, "links": {"next": "https://inspirehep.net/api/literature?page=2"}},
        {"hits": {"hits": [_hit(2), _hit(1)]}},
    )
    out = find(root, ["fam:vector-bosons"], fetch, today=TODAY, dry_run=True, sleep=lambda s: None)
    assert [c["recid"] for c in out["proc:dy-nc"]] == [1, 2]
    assert fetch.urls[1] == "https://inspirehep.net/api/literature?page=2"
    assert not (root / "candidates.json").exists() and (root / DY).read_text(encoding="utf-8") == before
    assert find(_repo(tmp_path / "b", watch=""), None, FakeFetch(), today=TODAY, sleep=lambda s: None) == {}


def test_truncated_search_keeps_last_run(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(candidates, "MAX_RESULTS", 1)
    root = _repo(tmp_path)
    before = (root / DY).read_text(encoding="utf-8")
    fetch = FakeFetch({"hits": {"hits": [_hit(1)]}, "links": {"next": "https://inspirehep.net/api/literature?page=2"}})
    out = find(root, None, fetch, today=TODAY, sleep=lambda s: None)
    assert [c["recid"] for c in out["proc:dy-nc"]] == [1] and len(fetch.urls) == 1
    assert (root / DY).read_text(encoding="utf-8") == before  # last_run not advanced: truncated hits are retried
    assert json.loads((root / "candidates.json").read_text(encoding="utf-8")) == out
    assert "watch.last_run not advanced" in capsys.readouterr().err


def test_explicit_ids_must_exist_and_be_watched(tmp_path):
    with pytest.raises(ValueError, match="no process or family"):
        find(_repo(tmp_path), ["proc:nope"], FakeFetch(), today=TODAY, sleep=lambda s: None)
    unwatched = _repo(tmp_path / "b", watch="")
    with pytest.raises(ValueError, match="no watch block.*proc:dy-nc"):
        find(unwatched, ["proc:dy-nc"], FakeFetch(), today=TODAY, sleep=lambda s: None)
    assert find(unwatched, ["fam:vector-bosons"], FakeFetch(), today=TODAY, sleep=lambda s: None) == {}
