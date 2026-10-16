"""Summarise HEPData table errors into schema-valid `uncertainty_exp` snippets (no uid: scripts.assign_uids adds it)."""
import re
import urllib.parse
import urllib.request
from datetime import date

from ruamel.yaml import YAML


def _get_text(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "pheno-map/0.1"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8")


def fetch_table(recid: int, table: str, version: int = 1, fetch=_get_text) -> dict:
    url = f"https://www.hepdata.net/download/table/ins{recid}/{urllib.parse.quote(table)}/{version}/yaml"
    return YAML(typ="safe").load(fetch(url))


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


def _bins(table: dict) -> list[list[tuple[str, float, bool]]]:
    """Per non-zero bin: [(label, |err|/|value| in %, asymmetric)]. Uses the first dependent variable."""
    return [
        [(e["label"], *_err_pct(e, v["value"])) for e in v.get("errors", [])]
        for v in table["dependent_variables"][0]["values"]
        if v["value"] != 0
    ]


def summarize(table: dict, label_map: dict, ref: str, today: date | None = None) -> list[dict]:
    """One uncertainty_exp per error label; `ref` is `hepdata:ins<recid>/<table>`."""
    name = ref.split("/", 1)[1]
    per_label: dict[str, list[tuple[float, bool]]] = {}
    for b in _bins(table):
        for label, pct, asym in b:
            per_label.setdefault(label, []).append((pct, asym))
    out = []
    for label, vals in per_label.items():
        cat = next((c for rx, c in label_map.items() if re.search(rx, label)), "other")
        pcts = [p for p, _ in vals]
        u = {"category": cat}
        if cat == "other":
            u["specific"] = label
        u["size"] = {"range": [round_sig(min(pcts)), round_sig(max(pcts))], "asymmetric": any(a for _, a in vals)}
        u["full_table"] = ref
        u["provenance"] = {
            "ref": ref, "locator": f"{name}, error '{label}'", "source": "hepdata",
            "status": "machine-verified", "date": (today or date.today()).isoformat(),
        }
        out.append(u)
    return out


def total_pct(table: dict, region_bin: int | None) -> float:
    """Quadrature sum of relative errors (%) at 1-based bin `region_bin` (zero-value bins skipped), or min over bins."""
    totals = [sum(p**2 for _, p, _ in b) ** 0.5 for b in _bins(table)]
    return min(totals) if region_bin is None else totals[region_bin - 1]
