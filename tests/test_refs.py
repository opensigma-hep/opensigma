import json
import shutil
from pathlib import Path

import pytest

from scripts.phenomap import refs
from scripts.phenomap.load import load_repo

FIX = Path(__file__).parent / "fixtures"
INSPIRE = FIX / "inspire"
ARXIV_TO_RECID = {"2001.00001": "1000001", "hep-ph/0201195": "1000002", "2003.00003": "1000003"}


class FakeFetch:
    def __init__(self):
        self.urls = []

    def __call__(self, url):
        self.urls.append(url)
        if "format=bibtex" in url:
            return (INSPIRE / f"bibtex_{url.split('?')[0].rsplit('/', 1)[1]}.txt").read_text()
        if "/arxiv/" in url:
            recid = ARXIV_TO_RECID[url.split("/arxiv/")[1]]
        else:
            recid = url.split("?")[0].rsplit("/", 1)[1]
        p = INSPIRE / f"{recid}.json"
        if not p.exists():
            raise OSError("404")
        return json.loads(p.read_text())


def test_resolve_inspire():
    cache = {}
    e = refs.resolve("inspire:1000001", cache, FakeFetch())
    assert e == {
        "recid": 1000001, "arxiv": "2001.00001", "doi": "10.1000/fake.1000001",
        "title": "Measurement of the Drell-Yan cross section in pp collisions at 13 TeV",
        "authors_short": "Fakeexp Collaboration", "year": 2020,
        "bibtex": '@article{Fake:1000001,\n    title = "{Fake 1}",\n    year = "2020"\n}\n',
    }
    assert cache["inspire:1000001"] == e


def test_resolve_arxiv_maps_to_recid():
    cache = {}
    e = refs.resolve("arXiv:hep-ph/0201195", cache, FakeFetch())
    assert e["recid"] == 1000002 and e["arxiv"] == "hep-ph/0201195"
    assert cache["arXiv:hep-ph/0201195"] == cache["inspire:1000002"] == e
    # figure locator is stripped
    cache2 = {}
    assert refs.resolve("arXiv:2001.00001, Fig. 3", cache2, FakeFetch())["recid"] == 1000001
    assert "arXiv:2001.00001" in cache2


def test_hepdata_ref_resolves_parent():
    cache = {}
    e = refs.resolve("hepdata:ins1000003/Table 1", cache, FakeFetch())
    assert e["recid"] == 1000003 and e["doi"] is None
    assert "inspire:1000003" in cache


def test_cache_hit_makes_no_calls():
    f = FakeFetch()
    cache = {}
    refs.resolve("inspire:1000001", cache, f)
    n = len(f.urls)
    refs.resolve("hepdata:ins1000001/Table 2", cache, f)
    assert len(f.urls) == n


def test_authors_short():
    f = FakeFetch()
    assert refs.resolve("inspire:1000004", {}, f)["authors_short"] == "Solo"
    assert refs.resolve("inspire:1000002", {}, f)["authors_short"] == "Alpha and Beta"
    assert refs.resolve("inspire:1000003", {}, f)["authors_short"] == "Gamma et al."
    assert refs.resolve("inspire:1000001", {}, f)["authors_short"] == "Fakeexp Collaboration"


def test_collect_refs():
    got = refs.collect_refs(load_repo(FIX / "repo_min"))
    assert {"inspire:1000001", "inspire:1000002", "inspire:1000003", "arXiv:2001.00001",
            "hepdata:ins1000001/Table 1", "hepdata:ins1000001/Table 2"} <= got
    assert not any(r in ("agent", "hepdata", "human") for r in got)


def _root(tmp_path, ref_list):
    (tmp_path / "families.yaml").write_text("[]\n")
    (tmp_path / "colliders.yaml").write_text("[]\n")
    (tmp_path / "processes" / "x").mkdir(parents=True)
    (tmp_path / "processes" / "x" / "p.yaml").write_text(json.dumps({"id": "proc:x", "refs": ref_list}))
    return tmp_path


def test_offline_reports_missing(tmp_path):
    root = _root(tmp_path, ["inspire:1000001", "inspire:9"])
    (root / "refs.json").write_text(json.dumps({"inspire:1000001": {"recid": 1000001}}))
    f = FakeFetch()
    assert refs.update_cache(root, offline=True, fetch=f) == ["inspire:9"]
    assert f.urls == []


def test_update_cache_online_writes_only_on_change(tmp_path):
    root = _root(tmp_path, ["inspire:1000001", "arXiv:2003.00003, Fig. 1", "inspire:424242"])
    sleeps = []
    f = FakeFetch()
    assert refs.update_cache(root, offline=False, fetch=f, sleep=sleeps.append) == ["inspire:424242"]
    assert sleeps and all(s == 0.35 for s in sleeps) and len(sleeps) == len(f.urls)
    path = root / "refs.json"
    text = path.read_text()
    data = json.loads(text)
    assert list(data) == sorted(data) and text.endswith("\n")
    assert {"inspire:1000001", "inspire:1000003", "arXiv:2003.00003"} <= set(data)
    mtime = path.stat().st_mtime_ns
    refs.update_cache(root, offline=False, fetch=f, sleep=lambda s: None)  # nothing new to cache
    assert path.stat().st_mtime_ns == mtime and path.read_text() == text


def test_online_failure_reason_collected(tmp_path):
    root = _root(tmp_path, ["inspire:424242"])
    errors = {}
    refs.update_cache(root, offline=False, fetch=FakeFetch(), sleep=lambda s: None, errors=errors)
    assert "OSError" in errors["inspire:424242"]


def test_offline_never_writes_real_fixture(tmp_path):
    root = tmp_path / "repo"
    shutil.copytree(FIX / "repo_min", root)
    before = (root / "refs.json").read_bytes()
    assert refs.update_cache(root, offline=True, fetch=FakeFetch()) == []
    assert (root / "refs.json").read_bytes() == before


def test_offline_does_not_create_refs_json(tmp_path):
    root = tmp_path / "repo"
    shutil.copytree(FIX / "repo_min", root)
    (root / "refs.json").unlink()
    assert refs.update_cache(root, offline=True, fetch=FakeFetch())  # all unresolved
    assert not (root / "refs.json").exists()


def _live_shape(**extra):
    """Hand-written mirror of live INSPIRE single-record metadata: no `earliest_date`."""
    return {"metadata": {"control_number": 77, "titles": [{"title": "T"}], **extra}}


@pytest.mark.parametrize("dates,year", [
    ({"preprint_date": "2016-09-02", "legacy_creation_date": "2017-01-01"}, 2016),
    ({"legacy_creation_date": "2017-01-01"}, 2017),
    ({"earliest_date": "2015-05-05", "preprint_date": "2016-09-02"}, 2015),
    ({"imprints": [{"date": "2018-03"}]}, 2018),
    ({}, None),
])
def test_resolve_year_fallback(dates, year):
    fetch = lambda url: "@article{x}\n" if "bibtex" in url else _live_shape(**dates)  # noqa: E731
    assert refs.resolve("inspire:77", {}, fetch)["year"] == year


def test_resolve_year_from_bibtex_when_no_dates():
    fetch = lambda url: '@article{x,\n    year = "2018"\n}\n' if "bibtex" in url else _live_shape()  # noqa: E731
    assert refs.resolve("inspire:77", {}, fetch)["year"] == 2018


def test_resolve_missing_optional_metadata_is_null():
    fetch = lambda url: "@article{x}\n" if "bibtex" in url else _live_shape(preprint_date="2016-09-02")  # noqa: E731
    e = refs.resolve("inspire:77", {}, fetch)
    assert (e["arxiv"], e["doi"], e["title"]) == (None, None, "T")
    assert e["authors_short"] is None
