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


def _walk(x, path=()):
    """Yield (path, dict) for every dict in a nested structure."""
    if isinstance(x, dict):
        yield path, x
        for k, v in x.items():
            yield from _walk(v, path + (k,))
    elif isinstance(x, list):
        for i, v in enumerate(x):
            yield from _walk(v, path + (i,))


# keys whose value (str or list of str) must be an existing id
_REF_KEYS = {"compared_to", "uses_amplitudes", "superseded_by", "also_in", "collider", "family",
             "measurement", "amplitude", "process", "extracted_from"}


def validate_integrity(repo: dict) -> list[Issue]:
    issues = []
    roots = [("families.yaml", o) for o in repo["families"]] + [("colliders.yaml", o) for o in repo["colliders"]]
    roots += [(o["_file"], o) for k in ("processes", "amplitudes", "parameters") for o in repo[k]]

    def err(file, path, msg, level="error"):
        issues.append(Issue(level, file, "/".join(map(str, path)), msg))

    names, uids = {}, {}  # ids and aliases share one namespace; key -> (file, path)
    for file, root in roots:
        for path, d in _walk(root):
            for key in ([d["id"]] if isinstance(d.get("id"), str) else []) + list(d.get("aliases", [])):
                if key in names:
                    err(file, path, f"id/alias {key!r} already claimed at {names[key][0]} ({names[key][1]})")
                else:
                    names[key] = (file, "/".join(map(str, path)))
            if isinstance(d.get("provenance"), dict) and "uid" in d["provenance"]:
                uid = d["provenance"]["uid"]
                if uid in uids:
                    err(file, path + ("provenance",), f"duplicate provenance uid {uid!r} (also at {uids[uid][0]} {uids[uid][1]})")
                else:
                    uids[uid] = (file, "/".join(map(str, path + ("provenance",))))
            if d.get("category") == "other":
                err(file, path, "uncertainty category 'other': prefer a specific category", "warning")

    # aliases are not valid reference targets
    ids = {d["id"] for _, root in roots for _, d in _walk(root) if isinstance(d.get("id"), str)}

    for file, root in roots:
        for path, d in _walk(root):
            refs = [(k, d[k]) for k in _REF_KEYS if k in d]
            if isinstance(d.get("headline"), dict):
                refs.append(("headline/observable", d["headline"].get("observable")))
            for key, val in refs:
                for v in val if isinstance(val, list) else [val]:
                    if isinstance(v, str) and v not in ids:
                        err(file, path + (key,), f"{file}: {key} points to unknown id {v!r}")
            if "predictions" in d:
                heads = [p for p in d["predictions"] if p.get("headline") is True]
                if len(heads) > 1:
                    err(file, path + ("predictions",), f"{d.get('id')}: {len(heads)} headline predictions (max 1)")

    for file, root in roots:
        if file.startswith("processes/"):
            folder, fam = file.split("/")[1], root["family"]
            if fam != f"fam:{folder}":
                err(file, ("family",), f"{file}: folder {folder!r} does not match family {fam!r}")
    return issues


def validate(repo: dict, schema_dir: Path) -> list[Issue]:
    issues = validate_schema(repo, schema_dir)
    return issues if any(i.level == "error" for i in issues) else issues + validate_integrity(repo)
