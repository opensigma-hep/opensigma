import json
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Literal

from jsonschema import Draft202012Validator
from referencing import Registry, Resource


@dataclass
class Issue:
    level: Literal["error", "warning"]
    file: str
    path: str
    msg: str


def _plain(x):
    """Copy of loaded data without the loader's `_file` key and with dates as ISO strings."""
    if isinstance(x, dict):
        return {k: _plain(v) for k, v in x.items() if k != "_file"}
    if isinstance(x, list):
        return [_plain(v) for v in x]
    return x.isoformat() if isinstance(x, date) else x


def validate_schema(repo: dict, schema_dir: Path) -> list[Issue]:
    schemas = {p.name: json.loads(p.read_text(encoding="utf-8")) for p in Path(schema_dir).glob("*.schema.json")}
    registry = Registry().with_resources((n, Resource.from_contents(s)) for n, s in schemas.items())
    issues = []

    def check(kind: str, data, file: str):
        v = Draft202012Validator(schemas[f"{kind}.schema.json"], registry=registry,
                                 format_checker=Draft202012Validator.FORMAT_CHECKER)
        for e in v.iter_errors(_plain(data)):
            issues.append(Issue("error", file, "/".join(map(str, e.absolute_path)), e.message))

    check("families", repo["families"], "families.yaml")
    check("colliders", repo["colliders"], "colliders.yaml")
    for key, kind in [("processes", "process"), ("amplitudes", "amplitude"), ("parameters", "parameter")]:
        for obj in repo[key]:
            check(kind, obj, obj["_file"])
    return issues
