"""Find INSPIRE papers matching each process's `watch:` block that the repo does not cite yet."""
import json
import sys
import time
import urllib.parse
from datetime import date, timedelta
from pathlib import Path

from scripts.assign_uids import _yaml

from .load import load_repo
from .refs import API, cache_key, collect_refs, http_get_json

MAX_RESULTS = 500


def query_for(process: dict, since: date) -> str:
    w = process["watch"]
    parts = [f"refersto:recid:{r}" for r in w["recids"]] + [f"({q})" for q in w["queries"]]
    return f"({' or '.join(parts)}) and de > {since.isoformat()}"


def cited_recids(repo: dict) -> set[int]:
    """Recids in refs.json plus every inspire:/hepdata: ref (arXiv refs count once resolved into refs.json)."""
    out = {e["recid"] for e in repo["refs"].values()}
    out |= {int(k[8:]) for k in map(cache_key, collect_refs(repo)) if k.startswith("inspire:")}
    return out


def _search(query: str, fetch, sleep) -> tuple[list[dict], bool]:
    """(hit metadata, truncated?)."""
    url = f"{API}/literature?q={urllib.parse.quote(query)}&size=100&fields=titles,arxiv_eprints,control_number"
    hits = []
    while url and len(hits) < MAX_RESULTS:
        sleep(0.35)  # INSPIRE limit ~15 requests / 5 s
        page = fetch(url)
        hits += [h["metadata"] for h in page["hits"]["hits"]]
        url = page.get("links", {}).get("next")
    if url:
        print(f"warning: more than {MAX_RESULTS} results for {query!r}; truncated, watch.last_run not advanced", file=sys.stderr)
    return hits, bool(url)


def find(root, proc_ids, fetch=http_get_json, today=None, since=None, dry_run=False, sleep=time.sleep) -> dict:
    """{proc_id: merged candidate list} for watched processes in proc_ids (process or family ids; None = all).

    Unless dry_run, rewrites candidates.json (keeping `channels` tags, dropping now-cited papers) and sets
    watch.last_run = today - 1 day (INSPIRE `de >` is strict; re-found papers dedup by recid) in each searched
    process file, except where the search was truncated. Nothing is written if any search fails.
    A process named explicitly in proc_ids must have a `watch` block.
    """
    root = Path(root)
    today = today or date.today()
    since = since or date(today.year - 5, today.month, min(today.day, 28))
    repo = load_repo(root)
    procs = [p for p in repo["processes"] if proc_ids is None or p["id"] in proc_ids or p["family"] in proc_ids]
    unknown = set(proc_ids or ()) - {i for p in procs for i in (p["id"], p["family"])}
    if unknown:
        raise ValueError(f"no process or family with id {sorted(unknown)}")
    unwatched = sorted(p["id"] for p in procs if p["id"] in (proc_ids or ()) and "watch" not in p)
    if unwatched:
        raise ValueError(f"process has no watch block: {unwatched}")
    cited = cited_recids(repo)
    stored = repo["candidates"]
    out, truncated = {}, set()
    for p in procs:
        if "watch" not in p:
            continue
        last = p["watch"].get("last_run")
        q = query_for(p, date.fromisoformat(str(last)) if last else since)
        merged = [c for c in stored.get(p["id"], []) if c["recid"] not in cited]
        seen = cited | {c["recid"] for c in merged}
        hits, cut = _search(q, fetch, sleep)
        if cut:
            truncated.add(p["id"])
        for md in hits:
            recid = int(md["control_number"])
            if recid not in seen:
                seen.add(recid)
                arxiv = (md.get("arxiv_eprints") or [{}])[0].get("value")
                merged.append({"recid": recid, "title": md["titles"][0]["title"], "arxiv": arxiv, "matched_by": q})
        out[p["id"]] = merged
    if not dry_run and out:
        _write(root, {**stored, **out}, [p["_file"] for p in procs if p["id"] in out and p["id"] not in truncated], today)
    return out


def _write(root: Path, candidates: dict, files: list[str], today: date) -> None:
    (root / "candidates.json").write_text(json.dumps(candidates, sort_keys=True, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    y = _yaml()
    for f in files:
        path = root / f
        doc = y.load(path.read_text(encoding="utf-8"))
        doc["watch"]["last_run"] = (today - timedelta(days=1)).isoformat()
        with path.open("w", encoding="utf-8") as fh:
            y.dump(doc, fh)
