from copy import deepcopy
from datetime import date
from pathlib import Path

from scripts.opensigma.derive import derive, is_stale, max_qcd_order, precision_ratio
from scripts.opensigma.load import load_repo

MIN = Path(__file__).parent / "fixtures" / "repo_min"
TODAY = date(2026, 10, 16)
LHC, TEV = "chan:dy-nc/lhc-13", "chan:dy-nc/tevatron-1960"
MEAS = "meas:dy-nc/lhc-13/fakeexp-2020"


def _repo():
    repo = deepcopy(load_repo(MIN))
    chan = repo["processes"][0]["channels"][0]
    return repo, chan, chan["observables"][0]


def _prov(uid, status="agent-draft"):
    return {"uid": uid, "ref": "inspire:1000001", "locator": "Table 9", "source": "agent", "status": status, "date": "2026-10-16"}


def _add_result(chan, obs, mid, pct, **flags):
    chan["measurements"].append({"id": mid, "experiment": "X", "dataset": "d", "ref": "inspire:1000001", **flags})
    obs["results"].append({"measurement": mid, "total": {"value_pct": pct, "provenance": _prov(mid[-8:].ljust(8, "0"))}, "uncertainties": []})


def _mid(n):
    return f"meas:dy-nc/lhc-13/m{n}"


def test_max_qcd():
    repo, chan, _ = _repo()
    assert max_qcd_order(chan) == "NNLO"
    assert max_qcd_order(repo["processes"][0]["channels"][1]) is None
    chan["observables"][0]["predictions"].append({"label": "x", "accuracy": {"qcd": "N3LO"}})
    assert max_qcd_order(chan) == "N3LO"


def test_ratio_basic():
    repo, chan, _ = _repo()
    assert precision_ratio(chan, False, {m["id"]: m for m in chan["measurements"]}) == 2.0
    assert derive(repo, TODAY)["cells"][LHC]["ratio"] == 2.0


def test_ratio_excludes_superseded_preliminary_and_projected():
    repo, chan, obs = _repo()
    _add_result(chan, obs, _mid(1), 0.1, superseded_by=MEAS)
    _add_result(chan, obs, _mid(2), 0.2, preliminary=True)
    _add_result(chan, obs, _mid(3), 0.05, projected=True, projection_source={"ref": "inspire:1000001", "date": "2026-10-16"})
    cell = derive(repo, TODAY)["cells"][LHC]
    assert cell["ratio"] == 2.0 and cell["ratio_with_projections"] == 20.0
    assert cell["n_measurements"] == 4
    s = derive(repo, TODAY)["observable_summary"][obs["id"]]
    assert s == {"exp_pct": 0.5, "exp_measurement": MEAS, "exp_pct_with_projections": 0.05,
                 "exp_measurement_with_projections": _mid(3), "th_pct": 1.0}


def test_ratio_none_without_headline():
    repo, _, _ = _repo()
    cell = derive(repo, TODAY)["cells"][TEV]
    assert cell["ratio"] is None and cell["ratio_with_projections"] is None and cell["max_qcd"] is None
    assert cell["min_status"] is None and cell["has_target"] is False and cell["candidates"] == 0


def test_ratio_none_when_a_side_is_missing():
    repo, chan, obs = _repo()
    del obs["predictions"][0]["total"]
    assert derive(repo, TODAY)["cells"][LHC]["ratio"] is None
    assert derive(repo, TODAY)["observable_summary"][obs["id"]]["th_pct"] is None
    repo, chan, obs = _repo()
    obs["results"] = []
    assert derive(repo, TODAY)["cells"][LHC]["ratio"] is None


def test_is_stale():
    assert is_stale(date(2025, 4, 16), TODAY) is False
    assert is_stale(date(2025, 4, 15), TODAY) is True
    assert is_stale("2025-04-15", TODAY) is True


def test_cell_fields():
    repo, chan, obs = _repo()
    repo["candidates"] = {"proc:dy-nc": [{"recid": 1, "channels": [LHC]}, {"recid": 2, "channels": [TEV]}, {"recid": 3}]}
    obs["results"][0]["total"]["provenance"]["status"] = "disputed"
    obs["theory_target"] = {"required_total": "1%", "source": "inspire:1000001", "provenance": _prov("11111111")}
    c = derive(repo, TODAY)["cells"][LHC]
    assert (c["process"], c["collider"], c["max_qcd"], c["coverage"], c["stale"]) == ("proc:dy-nc", "col:lhc-13", "NNLO", "complete", False)
    assert c["candidates"] == 1 and c["min_status"] == "disputed" and c["has_target"] is True and c["n_measurements"] == 1
    assert derive(repo, TODAY)["cells"][TEV]["candidates"] == 1


def test_family_stats_and_processes():
    repo, _, _ = _repo()
    d = derive(repo, TODAY)
    assert d["family_stats"]["fam:vector-bosons"] == {"n_processes": 1, "n_channels": 2, "frac_nnlo_plus": 0.5}
    assert d["family_stats"]["fam:top"] == {"n_processes": 0, "n_channels": 0, "frac_nnlo_plus": 0.0}


def test_also_in_appears_in_both_families():
    repo, _, _ = _repo()
    repo["processes"][0]["also_in"] = ["fam:top"]
    d = derive(repo, TODAY)
    assert d["family_processes"]["fam:vector-bosons"] == ["proc:dy-nc"] == d["family_processes"]["fam:top"]
    assert d["family_stats"]["fam:top"]["n_processes"] == 1
    assert d["parents"]["proc:dy-nc"] == "fam:vector-bosons"


def test_family_processes_primary_first():
    repo, _, _ = _repo()
    p2 = deepcopy(repo["processes"][0])
    p2.update(id="proc:other", family="fam:top", also_in=["fam:vector-bosons"], channels=[])
    repo["processes"].insert(0, p2)
    assert derive(repo, TODAY)["family_processes"]["fam:vector-bosons"] == ["proc:dy-nc", "proc:other"]


def test_amp_users_reverse_index():
    repo, _, obs = _repo()
    users = derive(repo, TODAY)["amp_users"]["amp:2L/0-qqbarV"]
    assert {"process": "proc:dy-nc", "row": "NNLO QCD", "column": "2L"} in users
    assert {"observable": obs["id"], "prediction_label": "NNLO QCD"} in users and len(users) == 2


def test_parents_and_aliases():
    repo, chan, obs = _repo()
    obs["aliases"] = ["obs:old"]
    d = derive(repo, TODAY)
    assert d["parents"] == {"proc:dy-nc": "fam:vector-bosons", LHC: "proc:dy-nc", TEV: "proc:dy-nc",
                            obs["id"]: LHC, MEAS: LHC}
    assert d["aliases"] == {"obs:old": obs["id"]}


def test_search_index():
    repo, chan, obs = _repo()
    obs["variable"] = "mll"
    obs["aliases"] = ["obs:old"]
    idx = {e["id"]: e for e in derive(repo, TODAY)["search_index"]}
    e = idx[obs["id"]]
    assert e["kind"] == "obs" and e["label"] == "Fiducial cross section"
    for word in ["obs:old", "mll", "NNLO", "2002.00002", "2001.00001"]:
        assert word in e["text"]
    assert "Drell-Yan" in idx["proc:dy-nc"]["text"] and "m_W" in idx["par:mw"]["text"]
    assert {"fam:top", LHC, TEV, MEAS, "amp:2L/0-qqbarV"} <= set(idx)
