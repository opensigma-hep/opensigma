import shutil
from copy import deepcopy
from pathlib import Path

import pytest

from scripts import build
from scripts.opensigma.lint import lint_data
from scripts.opensigma.load import load_repo

MIN = Path(__file__).parent / "fixtures" / "repo_min"


def _repo():
    repo = deepcopy(load_repo(MIN))
    ch = repo["processes"][0]["channels"][0]
    return repo, ch, ch["observables"][0]


def _kinds(repo):
    out = lint_data(repo)
    assert all(i.level == "warning" for i in out)
    return [i.kind for i in out]


def test_min_fixture_lint_clean():
    assert lint_data(load_repo(MIN)) == []


def test_breakdown_quadrature_mismatch():
    repo, _, obs = _repo()
    obs["predictions"][0]["total"]["value_pct"] = 2.0
    (i,) = lint_data(repo)
    assert i.kind == "breakdown" and "does not explain the total" in i.msg and i.file.startswith("processes/")


def test_breakdown_within_15_percent_ok():
    repo, _, obs = _repo()
    obs["predictions"][0]["total"]["value_pct"] = 1.1  # quadrature 1.0, 9% off
    assert _kinds(repo) == []


def test_single_component_must_explain_half():
    repo, _, obs = _repo()
    obs["results"][0]["uncertainties"].pop()  # only stat 0.3 of 0.5 left: 60%, fine
    assert _kinds(repo) == []
    obs["results"][0]["total"]["value_pct"] = 0.7  # 0.3 < 50% of 0.7
    assert _kinds(repo) == ["breakdown"]


def test_no_headline_prediction():
    repo, _, obs = _repo()
    del obs["predictions"][0]["headline"]
    assert _kinds(repo) == ["no-headline"]


def test_headline_without_total():
    repo, _, obs = _repo()
    del obs["predictions"][0]["total"]
    assert _kinds(repo) == ["headline-no-total"]


def test_unused_measurement():
    repo, ch, _ = _repo()
    ch["measurements"].append({"id": "meas:dy-nc/lhc-13/orphan", "experiment": "X", "dataset": "d", "ref": "inspire:1000001"})
    assert _kinds(repo) == ["unused-measurement"]


def test_unused_amplitude():
    repo, _, obs = _repo()
    del repo["processes"][0]["building_blocks"][0]["cells"]["2L"]["amplitude"]
    assert _kinds(repo) == []  # still used by the prediction
    del obs["predictions"][0]["uses_amplitudes"]
    (i,) = lint_data(repo)
    assert i.kind == "unused-amplitude" and i.file == "amplitudes/2L-0-qqbarV.yaml"


@pytest.mark.parametrize("label,qcd,bad", [
    ("NLO", "NNLO", True), ("aN3LO", "NNLO", True), ("approx. NNLO", "NLO", True),
    ("NNLO+NNLL", "NNLO", False), ("NLO EW", "NNLO", False), ("MC@NLO", "NNLO", False),
])
def test_label_order_mismatch(label, qcd, bad):
    repo, _, obs = _repo()
    obs["predictions"][0].update(label=label, accuracy={"qcd": qcd})
    assert _kinds(repo) == (["order-mismatch"] if bad else [])


def test_implausible_relative_total():
    repo, _, obs = _repo()
    obs["results"][0]["total"]["value_pct"] = 60.0
    obs["results"][0]["uncertainties"][0]["size"]["range"] = [60.0, 60.0]
    assert "implausible" in _kinds(repo)


def test_implausible_ratio():
    repo, _, obs = _repo()
    obs["predictions"][0]["total"]["value_pct"] = 15.0  # 15 / 0.5 = 30, but < 50%
    obs["predictions"][0]["uncertainties"][0]["size"]["range"] = [15.0, 15.0]
    obs["predictions"][0]["uncertainties"][1]["size"]["range"] = [0.0, 0.0]
    (i,) = lint_data(repo)
    assert i.kind == "implausible" and "ratio" in i.msg


def test_build_check_groups_and_summarises(tmp_path, capsys):
    root = tmp_path / "data"
    shutil.copytree(MIN, root)
    f = root / "processes/vector-bosons/dy-nc.yaml"
    f.write_text(f.read_text(encoding="utf-8").replace("            headline: true\n", ""), encoding="utf-8")
    args = ["--root", str(root), "--check", "--offline"]
    assert build.main(args) == 0
    out = capsys.readouterr().out
    assert "-- 1 warning(s): no-headline" in out and "WARNING" in out and out.rstrip().endswith("warnings: 1 (no-headline=1)")
    assert build.main(args + ["--lint-summary"]) == 0
    assert capsys.readouterr().out == "warnings: 1 (no-headline=1)\n"
