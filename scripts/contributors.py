"""CLI: python -m scripts.contributors [--root data] [--citation CITATION.cff] [--out .zenodo.json]

Regenerates .zenodo.json: creators from CITATION.cff (single source of truth), contributors =
unique provenance `verified_by` logins plus family `maintainers`.
"""
import argparse
import json
import sys
from pathlib import Path

from ruamel.yaml import YAML

from scripts.assign_uids import _provenances
from scripts.opensigma.load import load_repo


def zenodo_contributors(repo: dict) -> list[dict]:
    names = {m for f in repo["families"] for m in f.get("maintainers") or []}
    for key in ("processes", "amplitudes", "parameters"):
        names |= {pr["verified_by"] for d in repo[key] for pr in _provenances(d) if pr.get("verified_by")}
    return [{"name": n, "type": "DataCurator"} for n in sorted(names)]


def _creators(citation: Path) -> list[dict]:
    out = []
    for a in YAML(typ="safe").load(citation.read_text(encoding="utf-8"))["authors"]:
        c = {"name": f"{a['family-names']}, {a['given-names']}" if "family-names" in a else a["name"]}
        if a.get("affiliation"):
            c["affiliation"] = a["affiliation"]
        out.append(c)
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="data")
    ap.add_argument("--citation", default="CITATION.cff")
    ap.add_argument("--out", default=".zenodo.json")
    a = ap.parse_args(argv)
    meta = {
        "title": YAML(typ="safe").load(Path(a.citation).read_text(encoding="utf-8"))["title"],
        "upload_type": "dataset",
        "license": "CC-BY-4.0",
        "creators": _creators(Path(a.citation)),
        "contributors": zenodo_contributors(load_repo(Path(a.root))),
    }
    Path(a.out).write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
