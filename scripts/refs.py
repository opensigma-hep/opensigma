"""CLI: python -m scripts.refs [--root data] [--offline]; exits 1 if any ref is unresolved."""
import argparse
import sys
from pathlib import Path

from scripts.phenomap.refs import update_cache


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="data")
    ap.add_argument("--offline", action="store_true")
    a = ap.parse_args(argv)
    errors = {}
    missing = update_cache(Path(a.root), a.offline, errors=errors)
    for r in missing:
        print(f"unresolved ref: {r}: {errors[r]}", file=sys.stderr)
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
