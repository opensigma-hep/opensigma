"""Resolve inspire:/arXiv:/hepdata: refs to bibliographic entries cached in data/refs.json."""
import json
import re
import time
import urllib.request
from pathlib import Path

from .load import load_repo

API = "https://inspirehep.net/api"
FIELDS = "titles,arxiv_eprints,dois,authors.full_name,collaborations,publication_info,earliest_date,control_number"
REF_RE = re.compile(r"^(inspire:\d+|arXiv:[^,\s]+(, .+)?|hepdata:ins\d+/.+)$")
REF_KEYS = {"ref", "refs", "source", "full_table", "hepdata"}  # `source` is also the hepdata|agent|human enum: filtered by REF_RE


def http_get_json(url: str):
    """GET url; parsed JSON, or raw text for BibTeX requests."""
    req = urllib.request.Request(url, headers={"User-Agent": "pheno-map/0.1"})
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read().decode("utf-8")
    return body if "format=bibtex" in url else json.loads(body)


def collect_refs(repo: dict) -> set[str]:
    out = set()

    def walk(n):
        if isinstance(n, dict):
            for k, v in n.items():
                if k in REF_KEYS:
                    for r in v if isinstance(v, list) else [v]:
                        if isinstance(r, str) and REF_RE.match(r):
                            out.add(r)
                walk(v)
        elif isinstance(n, list):
            for v in n:
                walk(v)

    walk({k: v for k, v in repo.items() if k not in ("refs", "candidates")})
    return out


def cache_key(ref: str) -> str:
    """Cache key of a ref: hepdata -> parent inspire recid, figure locator stripped from arXiv."""
    if ref.startswith("hepdata:ins"):
        return "inspire:" + ref[len("hepdata:ins"):].split("/")[0]
    return ref.split(",")[0].strip()


def authors_short(md: dict) -> str:
    if md.get("collaborations"):
        return f"{md['collaborations'][0]['value']} Collaboration"
    names = [a["full_name"].split(",")[0] for a in md.get("authors", [])]
    if len(names) == 1:
        return names[0]
    return f"{names[0]} and {names[1]}" if len(names) == 2 else f"{names[0]} et al."


def resolve(ref: str, cache: dict, fetch=http_get_json) -> dict:
    key = cache_key(ref)
    if key in cache:
        return cache[key]
    if key.startswith("inspire:"):
        md = fetch(f"{API}/literature/{key[8:]}?fields={FIELDS}")["metadata"]
    else:
        md = fetch(f"{API}/arxiv/{key[6:]}")["metadata"]
    recid = int(md["control_number"])
    ikey = f"inspire:{recid}"
    if ikey not in cache:
        first = lambda k: (md.get(k) or [{}])[0].get("value")  # noqa: E731
        cache[ikey] = {
            "recid": recid,
            "arxiv": first("arxiv_eprints"),
            "doi": first("dois"),
            "title": md["titles"][0]["title"],
            "authors_short": authors_short(md),
            "year": int(md["earliest_date"][:4]),
            "bibtex": fetch(f"{API}/literature/{recid}?format=bibtex"),
        }
    cache[key] = cache[ikey]
    return cache[ikey]


def update_cache(root: Path, offline: bool, fetch=http_get_json, sleep=time.sleep) -> list[str]:
    """Resolve every ref in the repo; rewrite refs.json only if it changed. Returns unresolved refs."""
    root = Path(root)
    repo = load_repo(root)
    cache = dict(repo["refs"])

    def paced(url):
        sleep(0.35)  # INSPIRE limit ~15 requests / 5 s
        return fetch(url)

    missing = []
    for ref in sorted(collect_refs(repo)):
        if offline:
            ok = cache_key(ref) in cache
        else:
            try:
                resolve(ref, cache, paced)
                ok = True
            except Exception:  # network/HTTP/shape errors: report as unresolved, keep going
                ok = False
        if not ok:
            missing.append(ref)
    text = json.dumps(cache, sort_keys=True, ensure_ascii=False, indent=1) + "\n"
    path = root / "refs.json"
    if not path.exists() or path.read_text(encoding="utf-8") != text:
        path.write_text(text, encoding="utf-8")
    return missing
