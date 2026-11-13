"""Data-quality lint: build warnings only (never errors), run after validation passes."""
import re
from dataclasses import dataclass

from .derive import ORDERS, precision_ratio
from .validate import Issue, _walk


@dataclass
class LintIssue(Issue):
    kind: str = ""
    score: float = 0.0  # how bad: larger sorts first in "worst offenders" lists


def _pct(u) -> float | None:
    s = u.get("size", {})
    return max(s["range"]) if s.get("unit", "%") == "%" else None


def _breakdown(total, comps):
    """(score, text) if the listed components do not explain `total`, else None. Skips non-% components."""
    vals = [_pct(u) for u in comps]
    t = total["value_pct"]
    if not vals or None in vals or t <= 0:
        return None
    if len(vals) == 1:
        return (1 - vals[0] / t, f"single component {vals[0]:g}% vs total {t:g}%") if vals[0] < 0.5 * t else None
    q = sum(v * v for v in vals) ** 0.5
    return (abs(q - t) / t, f"quadrature sum {q:.3g}% vs total {t:g}%") if abs(q - t) / t > 0.15 else None


# "aNNLO", "approx. N3LO", "NLO+NNLL"; "NLO EW" is an electroweak order, not QCD
ORDER_TOKEN = re.compile(r"^(?:a|approx\.?\s*)?(N4LO|N3LO|NNLO|NLO)\b(?!\s*(?:EW|QED|electroweak))", re.I)


def lint_data(repo: dict) -> list[LintIssue]:
    out: list[LintIssue] = []

    def warn(file, path, kind, msg, score=0.0):
        out.append(LintIssue("warning", file, "/".join(map(str, path)), msg, kind, score))

    used_amps = set()
    for proc in repo["processes"]:
        f = proc["_file"]
        for row in proc.get("building_blocks", []):
            used_amps |= {c["amplitude"] for c in row["cells"].values() if "amplitude" in c}
        for ch in proc["channels"]:
            cp = ("channels", ch["id"])
            cited = {r["measurement"] for o in ch.get("observables", []) for r in o.get("results", [])}
            for m in ch.get("measurements", []):
                if m["id"] not in cited:
                    warn(f, cp + ("measurements", m["id"]), "unused-measurement", f"measurement {m['id']!r} is referenced by no observable result")
            for o in ch.get("observables", []):
                op = cp + ("observables", o["id"])
                for r in o.get("results", []):
                    if b := _breakdown(r["total"], r["uncertainties"]):
                        warn(f, op + ("results", r["measurement"]), "breakdown", f"breakdown does not explain the total: {b[1]}", b[0])
                preds = o.get("predictions", [])
                if preds and not any(p.get("headline") is True for p in preds):
                    warn(f, op, "no-headline", f"{o['id']}: has predictions but none flagged headline: true")
                for p in preds:
                    pp = op + ("predictions", p["label"])
                    used_amps |= set(p.get("uses_amplitudes", []))
                    if p.get("headline") is True and "total" not in p:
                        warn(f, pp, "headline-no-total", f"headline prediction {p['label']!r} has no uncertainty total")
                    if "total" in p and (b := _breakdown(p["total"], p.get("uncertainties", []))):
                        warn(f, pp, "breakdown", f"breakdown does not explain the total: {b[1]}", b[0])
                    m = ORDER_TOKEN.match(p["label"])
                    if m and m[1].upper() != p["accuracy"]["qcd"]:
                        warn(f, pp, "order-mismatch", f"label {p['label']!r} says {m[1].upper()} but accuracy.qcd is {p['accuracy']['qcd']}",
                             abs(ORDERS.index(m[1].upper()) - ORDERS.index(p["accuracy"]["qcd"])))
                for tp, t in _walk(o):
                    if isinstance(t.get("value_pct"), (int, float)) and t["value_pct"] > 50:
                        warn(f, op + tp, "implausible", f"relative total {t['value_pct']:g}% > 50% (asymmetry stored as relative error?)", t["value_pct"])
            meas = {m["id"]: m for m in ch.get("measurements", [])}
            ratio = precision_ratio(ch, False, meas)
            if ratio is not None and not 0.05 <= ratio <= 20:
                warn(f, cp + ("headline",), "implausible", f"theory/experiment ratio {ratio:.3g} outside [0.05, 20]", max(ratio, 1 / ratio) if ratio else 1e9)
    for a in repo["amplitudes"]:
        if a["id"] not in used_amps:
            warn(a["_file"], (), "unused-amplitude", f"amplitude {a['id']!r} is used by no building-block cell and no prediction")
    return out


def group_issues(issues):
    """(errors, {kind: warnings}) with the smallest groups first so long lists do not bury short ones."""
    kind = lambda i: getattr(i, "kind", "") or i.msg.split(":")[0][:40]  # noqa: E731  (non-lint warnings: msg prefix)
    groups: dict[str, list] = {}
    for i in issues:
        if i.level == "warning":
            groups.setdefault(kind(i), []).append(i)
    return [i for i in issues if i.level == "error"], dict(sorted(groups.items(), key=lambda kv: len(kv[1])))
