"""Add a unique 8-hex `uid` to every provenance record lacking one (round-trip YAML)."""
import secrets
import sys
from pathlib import Path

from ruamel.yaml import YAML

PATTERNS = ("processes/*/*.yaml", "amplitudes/*.yaml", "parameters/*.yaml")


def _yaml() -> YAML:
    y = YAML()
    y.preserve_quotes = True
    y.width = 4096
    y.indent(mapping=2, sequence=4, offset=2)  # match the hand-written data style: round-trip diffs stay minimal
    return y


def _provenances(node):
    """Yield every mapping found under a `provenance` key, at any depth."""
    if isinstance(node, dict):
        for k, v in node.items():
            if k == "provenance" and isinstance(v, dict):
                yield v
            yield from _provenances(v)
    elif isinstance(node, list):
        for v in node:
            yield from _provenances(v)


def assign_missing(root: Path) -> int:
    y = _yaml()
    docs = []
    for pat in PATTERNS:
        for p in sorted(Path(root).glob(pat)):
            docs.append((p, y.load(p.read_text(encoding="utf-8"))))
    used = {pr["uid"] for _, d in docs for pr in _provenances(d) if "uid" in pr}
    count = 0
    for p, d in docs:
        changed = False
        for pr in _provenances(d):
            if "uid" in pr:
                continue
            uid = secrets.token_hex(4)
            while uid in used:
                uid = secrets.token_hex(4)
            used.add(uid)
            pr.insert(0, "uid", uid)
            changed = True
            count += 1
        if changed:
            with p.open("w", encoding="utf-8") as f:
                y.dump(d, f)
    return count


if __name__ == "__main__":
    n = assign_missing(Path(sys.argv[1] if len(sys.argv) > 1 else "data"))
    print(f"assigned {n} uid(s)")
