"""Derived values: computed at build time from the validated repo, never stored in YAML."""
import calendar
from datetime import date

from .validate import _walk

ORDERS = ["LO", "NLO", "NNLO", "N3LO", "N4LO"]
LADDER = ["disputed", "agent-draft", "cross-checked", "machine-verified", "human-verified"]
STALE_MONTHS = 18


def _date(d) -> date:
    return d if isinstance(d, date) else date.fromisoformat(d)


def is_stale(last_reviewed, today) -> bool:
    """today > last_reviewed + 18 calendar months (day clamped to month end)."""
    d = _date(last_reviewed)
    m = d.year * 12 + d.month - 1 + STALE_MONTHS
    y, mo = divmod(m, 12)
    limit = date(y, mo + 1, min(d.day, calendar.monthrange(y, mo + 1)[1]))
    return _date(today) > limit


def max_qcd_order(channel) -> str | None:
    orders = [p["accuracy"]["qcd"] for o in channel.get("observables", []) for p in o.get("predictions", [])]
    return max(orders, key=ORDERS.index, default=None)


def _headline_obs(channel):
    head = (channel.get("headline") or {}).get("observable")
    return next((o for o in channel.get("observables", []) if o["id"] == head), None)


def _exp_pct(obs, measurements, include_projections) -> float | None:
    """Smallest result total, skipping superseded/preliminary (and projected unless asked) measurements."""
    vals = []
    for r in obs.get("results", []):
        m = measurements.get(r["measurement"], {})
        if m.get("superseded_by") or m.get("preliminary") or (m.get("projected") and not include_projections):
            continue
        vals.append(r["total"]["value_pct"])
    return min(vals, default=None)


def _th_pct(obs) -> float | None:
    p = next((p for p in obs.get("predictions", []) if p.get("headline") is True), None)
    return p.get("total", {}).get("value_pct") if p else None


def precision_ratio(channel, include_projections: bool, measurements: dict) -> float | None:
    obs = _headline_obs(channel)
    if obs is None:
        return None
    th, exp = _th_pct(obs), _exp_pct(obs, measurements, include_projections)
    return th / exp if th is not None and exp else None


def _min_status(channel) -> str | None:
    st = [d["provenance"]["status"] for _, d in _walk(channel) if isinstance(d.get("provenance"), dict)]
    return min(st, key=LADDER.index, default=None)


def _node_refs(node, refs) -> str:
    """Searchable arXiv ids cited directly by this node (not by child nodes that have their own id)."""
    out = []

    def visit(d, top):
        if isinstance(d, list):
            for v in d:
                visit(v, False)
            return
        if not isinstance(d, dict) or (not top and "id" in d):
            return
        for k, v in d.items():
            if k in ("ref", "refs"):
                for r in v if isinstance(v, list) else [v]:
                    key = r.split(",")[0]
                    out.append(refs.get(key, {}).get("arxiv") or (key[6:] if key.startswith("arXiv:") else ""))
            else:
                visit(v, False)

    visit(node, True)
    return " ".join(dict.fromkeys(a for a in out if a))


def _accuracy_labels(obs) -> list[str]:
    out = []
    for p in obs.get("predictions", []):
        a = p["accuracy"]
        out += [p["label"], a["qcd"], a.get("ew", ""), a.get("mixed", "")]
        out += [f"{r['accuracy']} {r['variable']}" for r in a.get("resummation", [])]
    return out


def derive(repo: dict, today: date) -> dict:
    cols = {c["id"]: c for c in repo["colliders"]}
    cells, parents, aliases, amp_users = {}, {}, {}, {a["id"]: [] for a in repo["amplitudes"]}
    summary, search = {}, []
    fam_procs = {f["id"]: [[], []] for f in repo["families"]}  # [primary, also_in]
    fam_chans = {f["id"]: [] for f in repo["families"]}

    def add(id_, kind, label, node, extra=()):
        text = " ".join(dict.fromkeys(str(t) for t in [label, *node.get("aliases", []), *extra, _node_refs(node, repo["refs"])] if t))
        search.append({"id": id_, "kind": kind, "label": label, "text": text})

    for f in repo["families"]:
        add(f["id"], "fam", f["name"], f)
    for a in repo["amplitudes"]:
        add(a["id"], "amp", a["id"], a)
    for p in repo["parameters"]:
        add(p["id"], "par", p["name"], p, [p["symbol"]])
    for root in [r for k in ("families", "amplitudes", "parameters", "processes") for r in repo[k]]:
        for _, d in _walk(root):
            for al in d.get("aliases", []):
                aliases[al] = d["id"]

    for proc in repo["processes"]:
        pid = proc["id"]
        parents[pid] = proc["family"]
        fam_procs[proc["family"]][0].append(pid)
        for fam in proc.get("also_in", []):
            fam_procs[fam][1].append(pid)
        add(pid, "proc", proc["name"], proc, [proc.get("description", "")])
        for row in proc.get("building_blocks", []):
            for col, cell in row["cells"].items():
                if "amplitude" in cell:
                    amp_users[cell["amplitude"]].append({"process": pid, "row": row["row"], "column": col})
        cands = repo["candidates"].get(pid, [])
        for ch in proc["channels"]:
            cid = ch["id"]
            parents[cid] = pid
            meas = {m["id"]: m for m in ch.get("measurements", [])}
            observables = ch.get("observables", [])
            mq = max_qcd_order(ch)
            cells[cid] = {
                "process": pid, "collider": ch["collider"], "max_qcd": mq,
                "ratio": precision_ratio(ch, False, meas),
                "ratio_with_projections": precision_ratio(ch, True, meas),
                "coverage": ch["coverage"], "stale": is_stale(ch["last_reviewed"], today),
                "candidates": sum(cid in c.get("channels", []) for c in cands),
                "n_measurements": len(meas), "min_status": _min_status(ch),
                "has_target": any("theory_target" in o for o in observables),
            }
            for fam in [proc["family"], *proc.get("also_in", [])]:
                fam_chans[fam].append(mq)
            add(cid, "chan", f"{proc['name']} — {cols[ch['collider']]['name']}", ch,
                [ch["initial_state"], ch["collider"], *(o["name"] for o in observables)])
            for m in meas.values():
                parents[m["id"]] = cid
                add(m["id"], "meas", f"{m['experiment']} {m['dataset']}", m, [m["experiment"]])
            for o in observables:
                parents[o["id"]] = cid
                summary[o["id"]] = {"exp_pct": _exp_pct(o, meas, False),
                                    "exp_pct_with_projections": _exp_pct(o, meas, True), "th_pct": _th_pct(o)}
                add(o["id"], "obs", o["name"], o, [o.get("variable", ""), *_accuracy_labels(o)])
                for p in o.get("predictions", []):
                    for amp in p.get("uses_amplitudes", []):
                        amp_users[amp].append({"observable": o["id"], "prediction_label": p["label"]})

    nnlo = ORDERS.index("NNLO")
    stats = {}
    for fid, (prim, also) in fam_procs.items():
        orders = fam_chans[fid]
        stats[fid] = {"n_processes": len(prim) + len(also), "n_channels": len(orders),
                      "frac_nnlo_plus": sum(o is not None and ORDERS.index(o) >= nnlo for o in orders) / len(orders) if orders else 0.0}
    return {"cells": cells, "family_stats": stats, "family_processes": {f: p + a for f, (p, a) in fam_procs.items()},
            "amp_users": amp_users, "parents": parents, "aliases": aliases, "search_index": search,
            "observable_summary": summary}
