"""CLI: python -m scripts.build [--root data] [--out site/data.json] [--check] [--offline] [--today YYYY-MM-DD]."""
import argparse
import json
import subprocess
import sys
from datetime import date
from pathlib import Path

from ruamel.yaml import YAML

from scripts.phenomap.derive import derive
from scripts.phenomap.load import load_repo
from scripts.phenomap.refs import update_cache
from scripts.phenomap.validate import validate


def _strip(x):
    if isinstance(x, dict):
        return {k: _strip(v) for k, v in x.items() if k != "_file"}
    if isinstance(x, list):
        return [_strip(v) for v in x]
    return x


def _git_sha() -> str | None:
    try:
        r = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True, check=True)
        return r.stdout.strip() or None
    except (OSError, subprocess.CalledProcessError):
        return None


def _release(root: Path) -> dict | None:
    """{version, doi, concept_doi} from <root>/release.yaml, or None while unreleased."""
    p = root / "release.yaml"
    return YAML(typ="safe").load(p.read_text(encoding="utf-8")) if p.exists() else None


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

    repo = load_repo(root)
    issues = validate(repo, Path(a.schema))
    failed = False
    for i in issues:
        print(f"{i.level.upper()} {i.file} {'/'.join(map(str, i.path))}: {i.msg}")
        failed |= i.level == "error"

    errors: dict = {}
    for ref in update_cache(root, a.offline, errors=errors):
        print(f"ERROR unresolved ref {ref}: {errors[ref]}")
        failed = True
    if failed:
        return 1

    repo = load_repo(root)  # refs.json may have been refreshed online
    if not a.check:
        out = {"build": {"date": today.isoformat(), "git_sha": _git_sha(), "release": _release(root)}, **_strip(repo), "derived": derive(repo, today)}
        Path(a.out).parent.mkdir(parents=True, exist_ok=True)
        Path(a.out).write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
