"""CLI: python -m scripts.linkcheck [--root data]; HEADs every INSPIRE/arXiv/HEPData URL cited in the data, exits 1 on any failure."""
import argparse
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from scripts.phenomap.load import load_repo
from scripts.phenomap.refs import cache_key, collect_refs


def url_for(ref: str) -> str:
    if ref.startswith("hepdata:ins"):
        recid, table = ref[len("hepdata:ins"):].split("/", 1)
        return f"https://www.hepdata.net/download/table/ins{recid}/{urllib.parse.quote(table)}/1/yaml"
    key = cache_key(ref)
    if key.startswith("inspire:"):
        return f"https://inspirehep.net/literature/{key[8:]}"
    return f"https://arxiv.org/abs/{key[6:]}"


def http_status(url: str) -> int:
    """HEAD, falling back to GET when the server rejects HEAD; HTTP error codes are returned, not raised."""
    for method in ("HEAD", "GET"):
        req = urllib.request.Request(url, method=method, headers={"User-Agent": "pheno-map/0.1"})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.status
        except urllib.error.HTTPError as e:
            if method == "HEAD" and e.code in (403, 405):
                continue
            return e.code
        except OSError:
            return 0
    return 0


def main(argv=None, head=http_status, sleep=time.sleep) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="data")
    a = ap.parse_args(argv)
    repo = load_repo(Path(a.root))
    urls = {url_for(r) for r in collect_refs(repo)}
    urls |= {f"https://inspirehep.net/literature/{v['recid']}" for v in repo["refs"].values() if "recid" in v}
    bad = 0
    for url in sorted(urls):
        sleep(0.35)  # stay under HEPData's 60 requests/min
        status = head(url)
        if not 200 <= status < 400:
            print(f"FAIL {status} {url}")
            bad += 1
    print(f"{len(urls)} links checked, {bad} failed")
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
