"""CLI: python -m scripts.machine_verify [--root data] [--apply]

Recomputes every `source: hepdata` datum from its HEPData table. Mismatches are printed (exit 1);
with --apply, matches at agent-draft/cross-checked become machine-verified (YAML round-trip, status only).
"""
import argparse
import math
import re
import sys
from pathlib import Path
from typing import NamedTuple

from ruamel.yaml import YAML

from scripts.assign_uids import PATTERNS, _yaml
from scripts.opensigma import hepdata

LABEL_MAP = Path(__file__).parent.parent / "data" / "hepdata_label_map.yaml"
HEP_REF = re.compile(r"^hepdata:ins(\d+)/(.+)$")
UPGRADABLE = {"agent-draft", "cross-checked"}
TOL = 1e-2


class Mismatch(NamedTuple):
    file: Path
    uid: str
    stored: object
    fetched: object


def _close(a, b) -> bool:
    return math.isclose(a, b, rel_tol=TOL)


def check(root: Path, fetch=hepdata.fetch_table, apply: bool = False) -> list[Mismatch]:
    label_map = YAML(typ="safe").load(LABEL_MAP)
    tables: dict[str, dict] = {}

    def table(ref):
        if ref not in tables:
            m = HEP_REF.match(ref)
            if not m:
                raise ValueError(f"not a hepdata ref: {ref!r}")
            try:
                tables[ref] = fetch(int(m[1]), m[2])
            except Exception as e:
                raise RuntimeError(f"{ref}: {e}") from e
        return tables[ref]

    y, bad = _yaml(), []
    for pat in PATTERNS[:1]:  # only processes carry per-result hepdata data
        for p in sorted(Path(root).glob(pat)):
            doc, changed = y.load(p.read_text(encoding="utf-8")), False
            for ch in doc.get("channels") or []:
                for ob in ch.get("observables") or []:
                    for r in ob.get("results") or []:
                        for pr, stored, fetched, ok in _items(r, table, label_map):
                            if ok:
                                if apply and pr["status"] in UPGRADABLE:
                                    pr["status"], changed = "machine-verified", True
                            else:
                                bad.append(Mismatch(p, pr["uid"], stored, fetched))
            if changed:
                with p.open("w", encoding="utf-8") as f:
                    y.dump(doc, f)
    return bad


def _items(result, table, label_map):
    """Yield (provenance, stored, fetched, within tolerance?)."""
    for u in result.get("uncertainties") or []:
        pr = u.get("provenance", {})
        if pr.get("source") != "hepdata":
            continue
        if "full_table" not in u:
            yield pr, [float(x) for x in u["size"]["range"]], None, False
            continue
        recomputed = hepdata.summarize(table(u["full_table"]), label_map, u["full_table"])
        hit = next((c for c in recomputed if (c["category"], c["specific"]) == (u["category"], u.get("specific"))), None)
        stored = [float(x) for x in u["size"]["range"]]
        fetched = hit and hit["size"]["range"]  # no exact (category, specific) match -> mismatch, never guess
        yield pr, stored, fetched, bool(fetched) and all(map(_close, stored, fetched))
    t = result.get("total") or {}
    pr = t.get("provenance", {})
    if pr.get("source") == "hepdata":
        b = re.search(r"\bbin (\d+)", pr["locator"])
        raw = hepdata.total_pct(table(pr["ref"]), int(b[1]) if b else None)
        ok = any(_close(t["value_pct"], f) for f in (raw, hepdata.round_sig(raw)))
        yield pr, t["value_pct"], hepdata.round_sig(raw), ok


def main(argv=None, fetch=hepdata.fetch_table) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="data")
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args(argv)
    try:
        bad = check(Path(a.root), fetch, a.apply)
    except Exception as e:  # network/parse failure must not look like success
        print(f"cannot fetch/verify HEPData table: {e}", file=sys.stderr)
        return 1
    for m in bad:
        print(f"MISMATCH {m.file} {m.uid}: stored={m.stored} fetched={m.fetched}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
