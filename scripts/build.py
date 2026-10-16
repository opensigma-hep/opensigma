"""CLI: python -m scripts.build [--root data] [--out site/data.json] [--check] [--offline] [--today YYYY-MM-DD]."""
import argparse
import json
import re
import subprocess
import sys
from datetime import date
from pathlib import Path

from ruamel.yaml import YAML

from scripts.opensigma.derive import derive
from scripts.opensigma.load import LoadError, load_repo
from scripts.opensigma.refs import update_cache
from scripts.opensigma.validate import _plain, validate


def _git_sha() -> str | None:
    try:
        r = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True, check=True)
        return r.stdout.strip() or None
    except (OSError, subprocess.CalledProcessError):
        return None


DOI_RE = re.compile(r"^10\.\d{4,}/\S+$")


def _release(root: Path) -> dict | None:
    """{version, doi, concept_doi} from <root>/release.yaml, or None while unreleased; ValueError if malformed."""
    p = root / "release.yaml"
    if not p.exists():
        return None
    rel = _plain(YAML(typ="safe").load(p.read_text(encoding="utf-8")))
    if not isinstance(rel, dict):
        raise ValueError("must be a mapping {version, doi, concept_doi}")
    if not (isinstance(rel.get("version"), str) and rel["version"].strip()):
        raise ValueError("version must be a non-empty string")
    for k in ("doi", "concept_doi"):
        if not (isinstance(rel.get(k), str) and DOI_RE.match(rel[k])):
            raise ValueError(f"{k} must be a bare DOI like 10.5281/zenodo.123, got {rel.get(k)!r}")
    return rel


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="data")
    ap.add_argument("--schema", default="data/schema")
    ap.add_argument("--out", default="site/data.json")
    ap.add_argument("--check", action="store_true", help="validate only; never write --out")
    ap.add_argument("--offline", action="store_true")
    ap.add_argument("--today", type=date.fromisoformat, default=None)
    a = ap.parse_args(argv)
    today = a.today or date.today()
    root = Path(a.root)

    try:
        repo = load_repo(root)
    except LoadError as e:
        print(f"ERROR {e}")
        return 1
    issues = validate(repo, Path(a.schema))
    failed = False
    for i in issues:
        print(f"{i.level.upper()} {i.file} {i.path}: {i.msg}")
        failed |= i.level == "error"
    try:
        release = _release(root)
    except ValueError as e:
        print(f"ERROR release.yaml: {e}")
        failed = True

    errors: dict = {}
    for ref in update_cache(root, a.offline, errors=errors):
        print(f"ERROR unresolved ref {ref}: {errors[ref]}")
        failed = True
    if failed:
        return 1

    repo = load_repo(root)  # refs.json may have been refreshed online
    if not a.check:
        out = {"build": {"date": today.isoformat(), "git_sha": _git_sha(), "release": release}, **_plain(repo), "derived": derive(repo, today)}
        Path(a.out).parent.mkdir(parents=True, exist_ok=True)
        Path(a.out).write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
