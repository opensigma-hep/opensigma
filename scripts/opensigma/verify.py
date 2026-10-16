"""Crowd verification: parse the ✓/⚑ issue form and apply a status-only YAML edit."""
import re
from calendar import monthrange
from datetime import date, datetime
from pathlib import Path

from ruamel.yaml import YAML
from ruamel.yaml.scalarstring import DoubleQuotedScalarString

from scripts.assign_uids import PATTERNS, _provenances, _yaml

# Field labels of the issue forms (.github/ISSUE_TEMPLATE/{verify,flag}.yml); GitHub renders
# each as "### <label>". Keep in sync with the templates (test_templates_match_labels).
LABELS = {
    "uid": "Datum uid",
    "value": "Value",
    "locator": "Locator",
    "link": "Source link(s)",
    "page": "Page",
    "comment": "Comment",
    "action": "Action",
}
ACTIONS = ("verify", "flag")
UID = re.compile(r"[0-9a-f]{8}")
MIN_AGE_MONTHS = 6


def parse_issue(body: str) -> dict | None:
    """{uid, action, comment} from a rendered issue-form body, or None if it is not one of ours."""
    sections = dict(re.findall(r"^### (.+?)[ \t]*\r?\n\r?\n(.*?)(?=^### |\Z)", body or "", re.M | re.S))
    get = lambda k: sections.get(LABELS[k], "").strip()  # noqa: E731
    uid, action = get("uid"), get("action")
    if not UID.fullmatch(uid) or action not in ACTIONS:
        return None
    comment = get("comment")
    return {"uid": uid, "action": action, "comment": "" if comment == "_No response_" else comment}


def _add_months(d: datetime, n: int) -> datetime:
    y, m = divmod(d.month - 1 + n, 12)
    y, m = d.year + y, m + 1
    return d.replace(year=y, month=m, day=min(d.day, monthrange(y, m)[1]))


def account_old_enough(created_at: datetime, now: datetime) -> bool:
    return now >= _add_months(created_at, MIN_AGE_MONTHS)


def _locate(root: Path, uid: str):
    """(path, round-trip doc, provenance mapping) of the datum with this uid, or None."""
    y = _yaml()
    for pat in PATTERNS:
        for p in sorted(Path(root).glob(pat)):
            doc = y.load(p.read_text(encoding="utf-8"))
            for pr in _provenances(doc):
                if pr.get("uid") == uid:
                    return p, doc, pr
    return None


def maintainers_for(root: Path, uid: str) -> list[str]:
    """GitHub handles maintaining the datum's family; [] if none (or amplitude/parameter: no family)."""
    hit = _locate(root, uid)
    fam = hit and hit[1].get("family")
    if not fam:
        return []
    fams = YAML(typ="safe").load((Path(root) / "families.yaml").read_text(encoding="utf-8"))
    return list(next((f.get("maintainers") or [] for f in fams if f["id"] == fam), []))


def apply(root: Path, uid: str, action: str, user: str, issue_url: str, today: date) -> str:
    """Edit status fields in place. Returns edited | unknown_uid | same_user | already_disputed_linked."""
    hit = _locate(root, uid)
    if hit is None:
        return "unknown_uid"
    path, doc, pr = hit
    q, outcome = DoubleQuotedScalarString, "edited"
    if action == "verify":
        if pr.get("verified_by") == user:
            return "same_user"
        pr.pop("issues", None)  # resolves a dispute
        pr.update(status="human-verified", verified_by=user, date=q(today.isoformat()), issue=q(issue_url))
    elif pr.get("status") == "disputed":
        outcome = "already_disputed_linked"
        if issue_url in (pr.get("issues") or []) or issue_url == pr.get("issue"):
            return outcome  # already linked: leave the file untouched
        pr.setdefault("issues", []).append(q(issue_url))
    else:
        pr.update(status="disputed", issue=q(issue_url))
    with path.open("w", encoding="utf-8") as f:
        _yaml().dump(doc, f)
    return outcome
