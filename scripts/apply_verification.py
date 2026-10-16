"""CLI for the verify workflow: python -m scripts.apply_verification --root data --issue-body-file F ...

Prints `outcome=<..>`, `uid=<..>`, `maintainers=<comma list>` lines (appended to $GITHUB_OUTPUT by the workflow).
Always exits 0 for a handled outcome; the workflow decides what to do with it.
"""
import argparse
from datetime import date, datetime, timezone
from pathlib import Path

from scripts.opensigma import verify


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="data")
    ap.add_argument("--issue-body-file", required=True)
    ap.add_argument("--user", required=True)
    ap.add_argument("--created-at", required=True, help="ISO timestamp of the account creation")
    ap.add_argument("--issue-url", required=True)
    ap.add_argument("--action-label", required=True, choices=verify.ACTIONS)
    ap.add_argument("--today", help="YYYY-MM-DD override (tests)")
    a = ap.parse_args(argv)

    now = datetime.now(timezone.utc)
    if a.today:
        now = datetime.combine(date.fromisoformat(a.today), now.timetz())
    root = Path(a.root)
    parsed = verify.parse_issue(Path(a.issue_body_file).read_text(encoding="utf-8"))
    uid = parsed["uid"] if parsed else ""
    if parsed is None or parsed["action"] != a.action_label:  # label and form must agree
        outcome = "unparseable"
    elif not verify.account_old_enough(datetime.fromisoformat(a.created_at), now):
        outcome = "too_young"
    else:
        outcome = verify.apply(root, uid, a.action_label, a.user, a.issue_url, now.date())
    maint = verify.maintainers_for(root, uid) if uid else []
    print(f"outcome={outcome}\nuid={uid}\nmaintainers={','.join(maint)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
