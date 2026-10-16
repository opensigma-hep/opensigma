"""CLI: python -m scripts.candidates [--root data] [proc_or_family_id ...] [--since YYYY-MM-DD] [--dry-run]

Searches INSPIRE for each watched process (since watch.last_run, else --since, default 5 years ago) and
prints new candidate papers. Without --dry-run, updates candidates.json and watch.last_run.
"""
import argparse
import json
import sys
from datetime import date
from pathlib import Path

from scripts.opensigma.candidates import find


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("ids", nargs="*", help="proc:... or fam:... ids; none = all watched processes")
    ap.add_argument("--root", default="data")
    ap.add_argument("--since", type=date.fromisoformat, default=None, help="default: 5 years before today")
    ap.add_argument("--dry-run", action="store_true", help="print only, write nothing")
    a = ap.parse_args(argv)
    try:
        out = find(Path(a.root), a.ids or None, since=a.since, dry_run=a.dry_run)
    except ValueError as e:
        ap.error(str(e))
    print(json.dumps(out, ensure_ascii=False, indent=1))
    print(f"{sum(map(len, out.values()))} candidate(s) across {len(out)} watched process(es)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
