from pathlib import Path

from ruamel.yaml import YAML
from ruamel.yaml.error import YAMLError
import json

_yaml = YAML(typ="safe")


class LoadError(ValueError):
    """A data file that is empty, not valid YAML, or not the expected top-level type; str() is "<file>: <reason>"."""


def _read(path: Path, root: Path, kind: type = list):
    name = path.relative_to(root).as_posix()
    try:
        with path.open(encoding="utf-8") as f:
            d = _yaml.load(f)
    except YAMLError as e:
        mark = getattr(e, "problem_mark", None)
        raise LoadError(f"{name}: invalid YAML" + (f" at line {mark.line + 1}: {e.problem}" if mark else f": {e}")) from None
    if not isinstance(d, kind):
        raise LoadError(f"{name}: " + ("empty file" if d is None else f"expected a YAML {'mapping' if kind is dict else 'list'}, got {type(d).__name__}"))
    return d


def _read_dir(root: Path, pattern: str) -> list[dict]:
    out = []
    for p in sorted(root.glob(pattern)):
        d = _read(p, root, dict)
        d["_file"] = p.relative_to(root).as_posix()
        out.append(d)
    return out


def _read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def load_repo(root: Path) -> dict:
    root = Path(root)
    return {
        "families": _read(root / "families.yaml", root),
        "colliders": _read(root / "colliders.yaml", root),
        "processes": _read_dir(root, "processes/*/*.yaml"),
        "amplitudes": _read_dir(root, "amplitudes/*.yaml"),
        "parameters": _read_dir(root, "parameters/*.yaml"),
        "refs": _read_json(root / "refs.json"),
        "candidates": _read_json(root / "candidates.json"),
    }
