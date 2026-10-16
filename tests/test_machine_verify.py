import shutil
from pathlib import Path

from ruamel.yaml import YAML

from scripts import machine_verify
from scripts.phenomap import hepdata

FIX = Path(__file__).parent / "fixtures"
TABLE = YAML(typ="safe").load(FIX / "hepdata" / "table.yaml")
REF = "hepdata:ins1234567/Table 5"
STAT, TOTAL = "c3d4e5f6", "b2c3d4e5"  # uids in repo_min's dy-nc.yaml


def fetch(recid, table):
    assert (recid, table) == (1234567, "Table 5")
    return TABLE


def make_root(tmp_path, stat_range=(2.0, 3.0), status="agent-draft", total=None):
    root = tmp_path / "data"
    shutil.copytree(FIX / "repo_min", root)
    p = root / "processes/vector-bosons/dy-nc.yaml"
    y = YAML()
    y.preserve_quotes = True
    y.width = 4096
    doc = y.load(p.read_text(encoding="utf-8"))
    res = doc["channels"][0]["observables"][0]["results"][0]
    unc = res["uncertainties"][0]
    unc["specific"] = "stat"
    unc["size"]["range"] = list(stat_range)
    unc["full_table"] = REF
    unc["provenance"].update(source="hepdata", status=status, ref=REF)
    if total is not None:
        res["total"]["value_pct"] = total[0]
        res["total"]["provenance"].update(source="hepdata", ref=REF, locator=total[1])
    with p.open("w", encoding="utf-8") as f:
        y.dump(doc, f)
    return root, p


def test_match_sets_status(tmp_path):
    root, p = make_root(tmp_path)
    before = p.read_text(encoding="utf-8")
    assert machine_verify.check(root, fetch) == []
    assert p.read_text(encoding="utf-8") == before  # check alone never writes
    assert machine_verify.main(["--root", str(root), "--apply"], fetch=fetch) == 0
    after = p.read_text(encoding="utf-8").splitlines()
    diff = [(a, b) for a, b in zip(before.splitlines(), after) if a != b]
    assert len(diff) == 1 and "machine-verified" in diff[0][1]  # only the status field changed


def test_mismatch_reported(tmp_path, capsys):
    root, p = make_root(tmp_path, stat_range=(2.0, 3.5))
    before = p.read_text(encoding="utf-8")
    (m,) = machine_verify.check(root, fetch)
    assert (m.file.name, m.uid, m.stored, m.fetched) == ("dy-nc.yaml", STAT, [2.0, 3.5], [2.0, 3.0])
    assert machine_verify.main(["--root", str(root), "--apply"], fetch=fetch) == 1
    assert f"MISMATCH {p} {STAT}: stored=[2.0, 3.5] fetched=[2.0, 3.0]" in capsys.readouterr().out
    assert p.read_text(encoding="utf-8") == before


def test_never_downgrades_human_verified(tmp_path):
    for status in ("human-verified", "disputed", "machine-verified"):
        root, p = make_root(tmp_path / status, status=status)
        before = p.read_text(encoding="utf-8")
        assert machine_verify.main(["--root", str(root), "--apply"], fetch=fetch) == 0
        assert p.read_text(encoding="utf-8") == before


def test_total_checked_against_bin_or_min(tmp_path):
    expected = hepdata.round_sig(hepdata.total_pct(TABLE, None))
    root, _ = make_root(tmp_path / "ok", total=(expected, "Table 5, quadrature sum (min over bins)"))
    assert machine_verify.check(root, fetch) == []
    root, _ = make_root(tmp_path / "bin", total=(expected, "Table 5, bin 2"))  # bin 2 is not the minimum
    (m,) = machine_verify.check(root, fetch)
    assert m.uid == TOTAL and m.stored == expected


def test_unfetchable_table_exits_1(tmp_path, capsys):
    root, _ = make_root(tmp_path)

    def boom(recid, table):
        raise OSError("no network")

    assert machine_verify.main(["--root", str(root)], fetch=boom) == 1
    assert "Table 5" in capsys.readouterr().err


def _with_uncs(tmp_path, table, uncs, status="agent-draft"):
    """repo_min copy whose dy-nc results[0].uncertainties are `uncs` = [(category, specific|None, [lo, hi])]."""
    root, p = make_root(tmp_path)
    y = YAML()
    y.preserve_quotes = True
    y.width = 4096
    doc = y.load(p.read_text(encoding="utf-8"))
    res = doc["channels"][0]["observables"][0]["results"][0]
    res["uncertainties"] = [
        {"category": c, **({"specific": s} if s else {}), "size": {"range": r, "unit": "%", "asymmetric": False},
         "full_table": REF, "provenance": {"uid": f"0000000{i}", "ref": REF, "locator": "Table 5", "source": "hepdata",
                                            "status": status, "date": "2026-10-16"}}
        for i, (c, s, r) in enumerate(uncs)
    ]
    with p.open("w", encoding="utf-8") as f:
        y.dump(doc, f)
    return root, p, lambda recid, t: table


def test_lumi_with_specific_matches_and_cross_checked_upgrades(tmp_path):
    root, p, f = _with_uncs(tmp_path, TABLE, [("lumi", "Luminosity", [2.5, 2.5])], status="cross-checked")
    assert machine_verify.main(["--root", str(root), "--apply"], fetch=f) == 0
    assert "status: machine-verified" in p.read_text(encoding="utf-8")


def test_missing_specific_is_mismatch_not_wrong_match(tmp_path):
    # [2.0, 3.0] is the stat range; a lumi entry without `specific` must not pick it up
    root, p, f = _with_uncs(tmp_path, TABLE, [("lumi", None, [2.0, 3.0])])
    before = p.read_text(encoding="utf-8")
    (m,) = machine_verify.check(root, f)
    assert m.fetched is None
    assert machine_verify.main(["--root", str(root), "--apply"], fetch=f) == 1
    assert p.read_text(encoding="utf-8") == before


def test_same_category_labels_match_their_own_entry(tmp_path):
    t = {"dependent_variables": [{"values": [{"value": 100.0, "errors": [
        {"label": "eff", "symerror": 1.0}, {"label": "trigger", "symerror": 4.0}]}]}]}
    root, p, f = _with_uncs(tmp_path, t, [("efficiency", "eff", [1.0, 1.0]), ("efficiency", "trigger", [4.0, 4.0])])
    assert machine_verify.check(root, f) == []
    root, p, f = _with_uncs(tmp_path / "swap", t, [("efficiency", "eff", [4.0, 4.0]), ("efficiency", "trigger", [1.0, 1.0])])
    assert [m.fetched for m in machine_verify.check(root, f)] == [[1.0, 1.0], [4.0, 4.0]]
