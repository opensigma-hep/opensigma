# pheno-map

A map of collider-physics processes. Data lives as YAML under `data/` (`data/families.yaml`, `data/colliders.yaml`, `data/processes/`, `data/amplitudes/`, `data/parameters/`),
a Python build (`scripts/`) turns it into `site/data.json`, and a static JS site renders it.

## Setup

```bash
python3 -m venv .venv
.venv/bin/pip install -e '.[dev]'
.venv/bin/pytest
```

Code is MIT (`LICENSE`); data is CC BY 4.0 (`data/LICENSE`).

## CI & deployment

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main`: `pytest`, `npm test` (Node 22), `python -m scripts.build --check --offline`, and, only when `data/**` changed, `scripts.machine_verify` (report-only) and `scripts.linkcheck`. `.github/workflows/pages.yml` runs on pushes to `main` (and manually): it builds `site/data.json` with `--offline` and deploys `site/` to GitHub Pages at `https://pheno-map.github.io/pheno-map/`. The repo owner must first complete the Task 0 settings (create the `pheno-map` org/repo, set Pages source to "GitHub Actions"); neither workflow has been run live yet.

`.github/workflows/verify.yml` handles the site's ✓/⚑ issue forms (`.github/ISSUE_TEMPLATE/{verify,flag}.yml`): it applies a status-only edit through an auto-merged bot PR (verify PRs say `Closes #n`; flag PRs say `Refs #n`, so the dispute issue stays open for its maintainer). Owner setup: a GitHub App with secrets `BOT_APP_ID` / `BOT_PRIVATE_KEY`; "Allow auto-merge" on, with branch protection on `main` requiring `ci`; the issue labels `verify` and `flag` must exist; and the repo variable `FLAG_ASSIGNEE` (a GitHub user, used when a family has no `maintainers` in `data/families.yaml`, since an org owner cannot be assigned). Without `FLAG_ASSIGNEE` an unassigned flag just gets a comment.
