import shutil
from datetime import date, datetime, timezone
from pathlib import Path

import pytest
from ruamel.yaml import YAML

from scripts import apply_verification
from scripts.phenomap import verify
from scripts.phenomap.load import load_repo
from scripts.phenomap.validate import validate_schema

FIX = Path(__file__).parent / "fixtures"
SCHEMA = Path(__file__).parent.parent / "data" / "schema"
DY = "processes/vector-bosons/dy-nc.yaml"
UID = "b2c3d4e5"  # a datum in dy-nc.yaml
URL = "https://github.com/pheno-map/pheno-map/issues/7"
TODAY = date(2026, 10, 16)


def body(uid=UID, action="verify", comment="checked against Table 1"):
    return "".join(f"### {verify.LABELS[k]}\n\n{v}\n\n" for k, v in
                   dict(uid=uid, value="0.5", locator="Table 1", link="https://x.org",
                        page="#/proc:dy-nc", comment=comment, action=action).items())


@pytest.fixture
def root(tmp_path):
    r = tmp_path / "data"
    shutil.copytree(FIX / "repo_min", r)
    return r


def prov(root, uid=UID):
    return verify._locate(root, uid)[2]


def run(root, **kw):
    a = dict(uid=UID, action="verify", user="alice", issue_url=URL, today=TODAY) | kw
    return verify.apply(root, a.pop("uid"), a.pop("action"), a.pop("user"), a.pop("issue_url"), a.pop("today"))


def test_parse_issue_form_body():
    assert verify.parse_issue(body()) == {"uid": UID, "action": "verify", "comment": "checked against Table 1"}
    assert verify.parse_issue(body(action="flag", comment="_No response_"))["comment"] == ""


@pytest.mark.parametrize("bad", ["", "hello", "### Datum uid\n\nnot-a-uid\n\n", body(uid="XYZ"), body(action="delete"),
                                 body().replace(f"### {verify.LABELS['uid']}", "### Something else")])
def test_parse_garbled_body_returns_none(bad):
    assert verify.parse_issue(bad) is None


def test_unknown_uid(root):
    assert run(root, uid="00000000") == "unknown_uid"


def test_young_account_rejected():
    now = datetime(2026, 10, 16, tzinfo=timezone.utc)
    created = datetime(2026, 4, 16, tzinfo=timezone.utc)
    assert not verify.account_old_enough(created, datetime(2026, 10, 15, tzinfo=timezone.utc))  # 5 months 30 days
    assert verify.account_old_enough(created, datetime(2026, 10, 16, tzinfo=timezone.utc))  # 6 months
    assert verify.account_old_enough(datetime(2025, 1, 1, tzinfo=timezone.utc), now)


def test_verify_sets_fields_and_stays_valid(root):
    assert run(root) == "edited"
    p = prov(root)
    assert (p["status"], p["verified_by"], p["date"], p["issue"]) == ("human-verified", "alice", "2026-10-16", URL)
    assert validate_schema(load_repo(root), SCHEMA) == []


def test_same_user_reverify_no_edit(root):
    run(root)
    before = (root / DY).read_text(encoding="utf-8")
    assert run(root, today=date(2026, 11, 1)) == "same_user"
    assert (root / DY).read_text(encoding="utf-8") == before


def test_verify_preserves_yaml_comments(root):
    f = root / DY
    f.write_text(f.read_text(encoding="utf-8").replace("channels:", "# keep me\nchannels:", 1), encoding="utf-8")
    run(root)
    text = f.read_text(encoding="utf-8")
    assert "# keep me" in text and 'ref: "inspire:1000001", locator: "Table 1"' in text
    assert text.count("human-verified") == 1  # status-only: no other datum touched


def test_flag_disputes_keeping_value(root):
    assert run(root, action="flag") == "edited"
    p = prov(root)
    assert (p["status"], p["issue"]) == ("disputed", URL)
    assert "issues" not in p and "verified_by" not in p


def test_flag_on_disputed_appends_issue(root):
    run(root, action="flag")
    url2 = URL.replace("/7", "/9")
    assert run(root, action="flag", user="bob", issue_url=url2) == "already_disputed_linked"
    p = prov(root)
    assert p["status"] == "disputed" and p["issue"] == URL and list(p["issues"]) == [url2]
    assert validate_schema(load_repo(root), SCHEMA) == []


def test_flag_already_linked_url_is_noop(root):
    run(root, action="flag")
    run(root, action="flag", user="bob", issue_url=URL.replace("/7", "/9"))
    before = (root / DY).read_text(encoding="utf-8")
    for u in (URL, URL.replace("/7", "/9")):  # the first-dispute url and an appended one
        assert run(root, action="flag", user="carol", issue_url=u) == "already_disputed_linked"
        assert (root / DY).read_text(encoding="utf-8") == before


def test_verify_resolves_dispute(root):
    run(root, action="flag")
    run(root, action="flag", user="bob", issue_url=URL.replace("/7", "/9"))
    assert run(root, user="carol", issue_url=URL.replace("/7", "/11")) == "edited"
    p = prov(root)
    assert p["status"] == "human-verified" and p["verified_by"] == "carol" and "issues" not in p


def test_maintainers_for(root):
    fam = YAML()
    fams = fam.load(root / "families.yaml")
    fams[0]["maintainers"] = ["alice", "bob"]
    fam.dump(fams, root / "families.yaml")
    assert verify.maintainers_for(root, UID) == ["alice", "bob"]
    assert verify.maintainers_for(root, "c9d0e1f2") == []  # amplitude: no family -> owner fallback
    assert verify.maintainers_for(root, "00000000") == []


def cli(root, tmp_path, capsys, text, created="2020-01-01T00:00:00Z", label="verify"):
    f = tmp_path / "issue.md"
    f.write_text(text, encoding="utf-8")
    assert apply_verification.main(["--root", str(root), "--issue-body-file", str(f), "--user", "alice",
                                    "--created-at", created, "--issue-url", URL, "--action-label", label,
                                    "--today", "2026-10-16"]) == 0
    return dict(l.split("=", 1) for l in capsys.readouterr().out.splitlines())


def test_cli_outcomes(root, tmp_path, capsys):
    before = (root / DY).read_text(encoding="utf-8")
    assert cli(root, tmp_path, capsys, "garbage")["outcome"] == "unparseable"
    assert cli(root, tmp_path, capsys, body(action="flag"))["outcome"] == "unparseable"  # label/form mismatch
    assert cli(root, tmp_path, capsys, body(), created="2026-09-01T00:00:00Z")["outcome"] == "too_young"
    assert cli(root, tmp_path, capsys, body(uid="00000000"))["outcome"] == "unknown_uid"
    assert (root / DY).read_text(encoding="utf-8") == before  # every rejection left data untouched
    out = cli(root, tmp_path, capsys, body())
    assert out == {"outcome": "edited", "uid": UID, "maintainers": ""}
    assert cli(root, tmp_path, capsys, body())["outcome"] == "same_user"


@pytest.mark.parametrize("action", verify.ACTIONS)
def test_templates_match_labels(action):
    t = YAML(typ="safe").load((Path(__file__).parent.parent / ".github/ISSUE_TEMPLATE" / f"{action}.yml").read_text(encoding="utf-8"))
    fields = {f["id"]: f for f in t["body"] if "id" in f}
    assert {k: f["attributes"]["label"] for k, f in fields.items()} == verify.LABELS
    assert t["labels"] == [action] and fields["action"]["attributes"]["options"] == [action]
    assert fields["comment"]["validations"]["required"] and fields["comment"]["type"] == "textarea"


def test_edit_is_minimal_diff(root):
    f = root / DY
    before = f.read_text(encoding="utf-8").splitlines()
    run(root)
    after = f.read_text(encoding="utf-8").splitlines()
    assert len(before) == len(after) and sum(a != b for a, b in zip(before, after)) == 1
