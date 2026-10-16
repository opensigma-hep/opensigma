from pathlib import Path

from ruamel.yaml import YAML
import json

_yaml = YAML(typ="safe")


def _read(path: Path):
    with path.open(encoding="utf-8") as f:
        return _yaml.load(f)


def _read_dir(root: Path, pattern: str) -> list[dict]:
    out = []
    for p in sorted(root.glob(pattern)):
        d = _read(p)
        d["_file"] = p.relative_to(root).as_posix()
        out.append(d)
    return out


def _read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def load_repo(root: Path) -> dict:
    root = Path(root)
    return {
        "families": _read(root / "families.yaml"),
        "colliders": _read(root / "colliders.yaml"),
        "processes": _read_dir(root, "processes/*/*.yaml"),
        "amplitudes": _read_dir(root, "amplitudes/*.yaml"),
        "parameters": _read_dir(root, "parameters/*.yaml"),
        "refs": _read_json(root / "refs.json"),
        "candidates": _read_json(root / "candidates.json"),
    }
