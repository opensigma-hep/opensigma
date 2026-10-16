---
description: Independently re-extract every agent-draft datum changed on this branch and mark agreeing ones cross-checked
argument-hint: "[uid ...] (default: all agent-draft uids changed vs main)"
---

# /crosscheck $ARGUMENTS

You are the **second, independent** agent of DECISIONS.md #17. Run in a **fresh context**: do not reuse notes, drafts or reasoning from the agent that wrote the data. The owner starts this command by hand, or `/refresh` starts it in its own subagent. It never runs on a schedule. Work from the repo root.

## 1. List the uids to check, blind

This prints one JSON line per `agent-draft` datum that is new or changed against `main` (in commits or the working tree), optionally restricted to the uids in `$ARGUMENTS`. Each line holds the datum's uid, file, path, `ref` and `locator`, and **every number and value string is replaced by `<hidden>`**:

```bash
.venv/bin/python - $ARGUMENTS <<'PY'
import json, subprocess, sys
from pathlib import Path
from ruamel.yaml import YAML
from scripts.assign_uids import PATTERNS

WANT = set(sys.argv[1:])  # optional uid filter
HIDE = {"value", "required_total", "current_total", "status", "kind", "detail"}  # string-valued claims; numbers are hidden too

def data(text):
    out = {}
    def walk(n, path):
        if isinstance(n, dict):
            pr = n.get("provenance")
            if isinstance(pr, dict) and "uid" in pr:
                out[pr["uid"]] = ("/".join(path), n)
            for k, v in n.items():
                walk(v, path + [str(k)])
        elif isinstance(n, list):
            for i, v in enumerate(n):
                key = next((v[k] for k in ("id", "measurement", "label", "category", "row") if isinstance(v, dict) and k in v), i)
                walk(v, path + [str(key)])
    walk(YAML(typ="safe").load(text) if text else None, [])
    return out

def own(d):  # the datum's own claim: nested data with their own provenance are separate uids
    sub = lambda v: isinstance(v, dict) and "provenance" in v or isinstance(v, list) and any(map(sub, v))  # noqa: E731
    pr = d["provenance"]
    return {**{k: v for k, v in d.items() if k != "provenance" and not sub(v)}, "provenance": {"ref": pr["ref"], "locator": pr["locator"]}}

def mask(x, key=None):
    if isinstance(x, dict):
        return {k: v if k == "provenance" else mask(v, k) for k, v in x.items()}
    if isinstance(x, list):
        return [mask(v, key) for v in x]
    if isinstance(x, (int, float)) and not isinstance(x, bool) or key in HIDE:
        return "<hidden>"
    return x

for f in sorted(p for pat in PATTERNS for p in Path("data").glob(pat)):
    old = subprocess.run(["git", "show", f"main:{f.as_posix()}"], capture_output=True, text=True).stdout
    before, now = data(old), data(f.read_text(encoding="utf-8"))
    for uid, (path, d) in now.items():
        if (not WANT or uid in WANT) and d["provenance"]["status"] == "agent-draft" and (uid not in before or own(before[uid][1]) != own(d)):
            print(json.dumps({"uid": uid, "file": f.as_posix(), "path": path, "datum": mask(own(d))}, ensure_ascii=False, default=str))
PY
```

If it prints nothing, report "nothing to cross-check" and stop.

## 2. Re-extract each value before looking at the stored one

For each line, **before opening the YAML file or the diff**:
1. Fetch the source named by `ref`: the INSPIRE record `https://inspirehep.net/api/literature/<recid>`, the arXiv HTML `https://arxiv.org/html/<id>` (or abs/PDF), or the HEPData table.
2. Go to `locator`, read off the hidden fields (for example `value_pct`, `size.range`, region values, cell status) for the quantity named by `path`, and write your extraction down.
3. If the locator does not point to a unique number, or the source cannot be fetched, record that as a disagreement. **Never guess, and never fill a value from memory.**

Only after you have recorded all extractions, read the stored values (open the file at `path`).

## 3. Compare and record

- **Agreement**: the values match within rounding, meaning that rounded to the stored value's precision they are equal, or they differ by at most one unit in the last stored digit. Then change only that provenance's `status: agent-draft` to `status: cross-checked`. Do not touch any other field, and never set `verified_by`.
  For orders, compare against the order of the observable (fixed-order O(αs²) for a distribution that is zero at Born level, e.g. pT(ℓℓ), φ*, A_i, is `qcd: NLO`), not the paper's naming.
- **Disagreement**, or anything you could not extract: leave `status: agent-draft` and append one line to `crosscheck-report.md` at the repo root (create it if missing):
  `- <YYYY-MM-DD> <uid> <file> <path>: stored <stored>, re-extracted <yours> from <ref>, <locator> — <short reason>`

Then run `.venv/bin/python -m scripts.build --root data --check --offline`. If it fails, stop and report.

## 4. Report

Do not commit, push or open PRs. Report:
- the counts checked, cross-checked and disagreeing;
- the disagreeing uids;
- the build result.
