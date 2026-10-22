"""Summarise HEPData table errors into schema-valid `uncertainty_exp` snippets (no uid: scripts.assign_uids adds it)."""
import re
import subprocess
import time
import urllib.parse
from datetime import date

from ruamel.yaml import YAML
from ruamel.yaml.error import YAMLError


# HEPData's Cloudflare returns 403 to urllib (even with an honest UA) but 200 to curl: all HEPData HTTP goes through curl.
def curl_get(url: str, run=subprocess.run, sleep=time.sleep) -> str:
    for wait in (30, 60, 120, None):  # 429 = throttled (60 requests/min), not broken: back off and retry
        r = run(["curl", "-sSfL", "--max-time", "60", url], capture_output=True, text=True)
        if not (r.returncode and "429" in r.stderr) or wait is None:
            break
        sleep(wait)
    if r.returncode:
        raise OSError(f"curl {url} failed ({r.returncode}): {r.stderr.strip()}")
    return r.stdout


def curl_status(url: str, run=subprocess.run) -> int:
    """HTTP status of a HEAD request via curl; 0 on transport failure.

    HEPData answers a missing /yaml table download with 200 + an HTML page: that is reported as 404.
    """
    r = run(["curl", "-sS", "-I", "-L", "--max-time", "60", "-o", "/dev/null", "-w", "%{http_code} %{content_type}", url], capture_output=True, text=True)
    code, _, ctype = r.stdout.strip().partition(" ")
    if r.returncode or not code.isdigit():
        return 0
    return 404 if code == "200" and url.endswith("/yaml") and ctype.startswith("text/html") else int(code)


def fetch_table(recid: int, table: str, version: int = 1, fetch=curl_get) -> dict:
    url = f"https://www.hepdata.net/download/table/ins{recid}/{urllib.parse.quote(table)}/{version}/yaml"
    try:
        t = YAML(typ="safe").load(fetch(url))
    except YAMLError:
        t = None
    if not (isinstance(t, dict) and "dependent_variables" in t):  # a missing table comes back as 200 + HTML
        raise ValueError(f"{url}: not a HEPData YAML table (wrong table name or version?)")
    return t


# An error column that already is the total (e.g. "Total uncertainty", "stat+syst"): never a component.
TOTAL = re.compile(r"(?i)^\s*(total|tot\b)|stat[^a-z]*\+[^a-z]*sys")


def round_sig(x: float, n: int = 2) -> float:
    return float(f"{x:.{n}g}")


def _err_pct(err: dict, value: float) -> tuple[float, bool]:
    """(max(|plus|,|minus|) as % of |value|, asymmetric?). Numbers are absolute, "x%" strings relative."""
    def one(e):
        return float(e.rstrip("%")) if isinstance(e, str) and e.endswith("%") else float(e) / abs(value) * 100

    if "asymerror" in err:
        plus, minus = one(err["asymerror"]["plus"]), one(err["asymerror"]["minus"])
        return max(abs(plus), abs(minus)), plus != -minus
    return abs(one(err["symerror"])), False


def _bins(table: dict, column: int = 1) -> list[list[tuple[str, float, bool]] | None]:
    """Per bin, in original order: [(label, |err|/|value| in %, asymmetric)], or None for a zero-value or empty ('-') bin.

    Uses the 1-based dependent variable `column`; HEPData may give values as strings ('51.0').
    """
    deps = table["dependent_variables"]
    if not 1 <= column <= len(deps):
        raise ValueError(f"column {column} out of range 1..{len(deps)}")
    out = []
    for v in deps[column - 1]["values"]:
        value = 0.0 if v["value"] == "-" else float(v["value"])
        out.append(None if value == 0 else [(e.get("label", "error"), *_err_pct(e, value)) for e in v.get("errors", [])])
    return out


def summarize(table: dict, label_map: dict, ref: str, today: date | None = None, column: int = 1) -> list[dict]:
    """One uncertainty_exp per error label; `ref` is `hepdata:ins<recid>/<table>`."""
    name = ref.split("/", 1)[1] + col_locator(column)
    per_label: dict[str, list[tuple[float, bool]]] = {}
    for b in filter(None, _bins(table, column)):
        for label, pct, asym in b:
            if TOTAL.search(label):
                continue
            per_label.setdefault(label, []).append((pct, asym))
    out = []
    for label, vals in per_label.items():
        cat = next((c for rx, c in label_map.items() if re.search(rx, label)), "other")
        pcts = [p for p, _ in vals]
        u = {"category": cat, "specific": label}  # (category, specific) identifies the entry for machine_verify
        u["size"] = {"range": [round_sig(min(pcts)), round_sig(max(pcts))], "asymmetric": any(a for _, a in vals)}
        u["full_table"] = ref
        u["provenance"] = {
            "ref": ref, "locator": f"{name}, error '{label}'", "source": "hepdata",
            "status": "machine-verified", "date": (today or date.today()).isoformat(),
        }
        out.append(u)
    return out


def col_locator(column: int) -> str:
    """Locator fragment naming a non-default column; machine_verify reads it back with COLUMN."""
    return "" if column == 1 else f", column {column}"


COLUMN = re.compile(r", column (\d+)\b")


def total_pct(table: dict, region_bin: int | None, column: int = 1) -> float:
    """Relative total error (%) at 1-based bin `region_bin` (numbered over all bins), or min over non-zero bins.

    A bin's own total column wins; otherwise its errors are summed in quadrature.
    """
    def tot(b):
        given = [p for label, p, _ in b if TOTAL.search(label)]
        return max(given) if given else sum(p**2 for _, p, _ in b) ** 0.5

    bins = _bins(table, column)
    totals = [tot(b) if b else None for b in bins]  # no errors listed: unknown, not 0%
    if all(t is None for t in totals):
        raise ValueError("table has no non-zero bins with errors")
    if region_bin is None:
        return min(t for t in totals if t is not None)
    if not 1 <= region_bin <= len(bins):
        raise ValueError(f"bin {region_bin} out of range 1..{len(bins)}")
    if totals[region_bin - 1] is None:
        raise ValueError(f"bin {region_bin} has value 0 or '-', or no errors; relative error undefined")
    return totals[region_bin - 1]
