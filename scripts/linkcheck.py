"""CLI: python -m scripts.linkcheck [--root data] [--registry]; HEADs every INSPIRE/arXiv/HEPData URL cited in the data and
every URL in experiments.yaml / colliders.yaml (only those with --registry), exits 1 on any failure."""
import argparse
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from scripts.opensigma.hepdata import curl_status
from scripts.opensigma.load import load_repo
from scripts.opensigma.refs import cache_key, collect_refs


def url_for(ref: str) -> str:
    if ref.startswith("hepdata:ins"):
        recid, table = ref[len("hepdata:ins"):].split("/", 1)
        return f"https://www.hepdata.net/download/table/ins{recid}/{urllib.parse.quote(table)}/1/yaml"
    key = cache_key(ref)
    if key.startswith("inspire:"):
        return f"https://inspirehep.net/literature/{key[8:]}"
    return f"https://arxiv.org/abs/{key[6:]}"


def registry_urls(repo: dict) -> set[str]:
    """Every URL in the experiment/working-group registry and in the optional collider facts."""
    urls = set()
    for o in [*repo.get("experiments", []), *repo.get("groups", []), *repo["colliders"]]:
        urls |= {l["url"] for l in o.get("links", [])} | set(o.get("sources", []))
        urls |= {u for u in (o.get("url"), o.get("luminosity", {}).get("source")) if u}
    return urls


def http_status(url: str) -> int:
    """HEAD, falling back to GET when the server rejects HEAD; HTTP error codes are returned, not raised."""
    if urllib.parse.urlparse(url).hostname not in ("inspirehep.net", "arxiv.org"):
        return curl_status(url)  # Cloudflare (HEPData) and several lab sites block urllib
    for method in ("HEAD", "GET"):
        req = urllib.request.Request(url, method=method, headers={"User-Agent": "opensigma/0.1"})
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
    ap.add_argument("--registry", action="store_true", help="check only experiments.yaml / colliders.yaml URLs")
    a = ap.parse_args(argv)
    repo = load_repo(Path(a.root))
    urls = registry_urls(repo)
    if not a.registry:
        urls |= {url_for(r) for r in collect_refs(repo)}
        urls |= {f"https://inspirehep.net/literature/{v['recid']}" for v in repo["refs"].values() if "recid" in v}
    bad = 0
    for url in sorted(urls):
        sleep(0.35)  # stay under HEPData's 60 requests/min
        for wait in (30, 60, 120):  # 429 = throttled, not broken: back off and retry
            status = head(url)
            if status != 429:
                break
            sleep(wait)
        if status == 429:
            print(f"WARN 429 (still rate-limited, not counted as broken) {url}")
        elif not 200 <= status < 400:
            print(f"FAIL {status} {url}")
            bad += 1
    print(f"{len(urls)} links checked, {bad} failed")
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
