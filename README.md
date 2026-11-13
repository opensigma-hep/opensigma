# OpenSigma

OpenSigma is a catalogue of collider-physics processes for people who compute or use precision predictions. For each observable it records what has been measured, what theory has achieved, and the uncertainty budget of both. Every number carries a reference, the exact place in that reference (a locator), and a verification status.

The catalogue is plain YAML under `data/`. A Python build validates it and turns it into `site/data.json`, and a static JavaScript site (no bundler, no server) renders it. The site is meant to be served at <https://opensigma-hep.github.io/opensigma/>.

Scope: Standard Model processes at past, running and future colliders. The site's `#/about` page explains how to read it and `#/glossary` defines every label it shows.

## Quick start

Requirements: Python 3.12 or newer, and Node 22 for the JavaScript tests.

```bash
python3 -m venv .venv
.venv/bin/pip install -e '.[dev]'

.venv/bin/python -m scripts.build --offline   # validate data/ and write site/data.json
python3 -m http.server -d site                # then open http://localhost:8000
```

`site/data.json` is not committed; build it before serving. `--offline` uses the reference metadata already cached in `data/refs.json`; without it the build also resolves any new reference on INSPIRE.

Checks, the same three that CI runs:

```bash
.venv/bin/pytest
npm test
.venv/bin/python -m scripts.build --check --offline   # validate only, writes nothing
```

## Repository layout

| Path | What it holds |
| --- | --- |
| `data/families.yaml`, `data/colliders.yaml` | The families and the colliders (one list each). |
| `data/experiments.yaml` | Experiments and working groups, with links to their official pages. |
| `data/processes/<family>/<process>.yaml` | One file per process: building blocks, channels, measurements, observables, predictions. |
| `data/amplitudes/*.yaml` | The shared loop-amplitude library. |
| `data/parameters/*.yaml` | Standard Model parameters and their determinations. |
| `data/schema/*.json` | JSON Schema for all of the above. |
| `data/refs.json` | Cached reference metadata and BibTeX (written by the build, committed). |
| `data/candidates.json` | Papers found by the literature watch and not yet incorporated. |
| `data/hepdata_label_map.yaml` | Regex table from HEPData error labels to uncertainty categories. |
| `scripts/` | Build, validation, HEPData ingestion, verification and link-check tools. |
| `site/` | The static site: `index.html`, `css/`, `js/` (views in `js/views/`), tests in `test/`. |
| `tests/` | Python tests and fixtures. |
| `.claude/commands/` | The agent commands `/draft-process`, `/crosscheck`, `/refresh`. |
| `.github/` | CI, Pages deployment, the verify workflow and its issue forms. |
| `DECISIONS.md` | Numbered log of design decisions. Later entries supersede earlier ones where they say so. |
| `docs/data-model.md` | Field-by-field reference for the YAML files. |

## Data model in ten lines

```
Family                     data/families.yaml            e.g. Vector bosons
└─ Process                 data/processes/<family>/*.yaml   collider-independent; owns the building-block table
   └─ Channel              the process at one collider; coverage, review date, headline observable
      ├─ Measurement       one experimental analysis: experiment, dataset, paper, HEPData record
      └─ Observable        one quantity: total, fiducial, differential, ratio, asymmetry or pseudo-observable
         ├─ Result         total uncertainty and breakdown of one Measurement for this Observable
         └─ Prediction     one calculation: accuracy, codes, total uncertainty and breakdown, references
Amplitude  (data/amplitudes/)  loop amplitude, referenced from building-block cells and predictions
Parameter  (data/parameters/)  αs, m_W, …: determinations, linked to the observables they come from
```

Uncertainties are stored as relative sizes in percent with a fixed category (for example `stat`, `lumi`, `MHOU`, `PDF`). Cross-section values and full data tables are not copied; they are linked. Values that follow from the data (highest order per channel, theory ÷ experiment ratio, statistics) are computed by the build and never stored. Details: [`docs/data-model.md`](docs/data-model.md).

## How verification works

Every datum has a `provenance` record with a `status`:

| Status | Meaning |
| --- | --- |
| `agent-draft` | Extracted by an AI agent from the cited source and locator; unchecked. |
| `cross-checked` | A second agent, in a fresh context and without seeing the stored value, re-extracted it and agrees. No human has checked it. |
| `machine-verified` | Ingested from HEPData; `scripts.machine_verify` re-downloads the table and reproduces the value. |
| `human-verified` | A person confirmed it against the source; `verified_by` holds their GitHub login. |
| `disputed` | A person flagged it. The value stays visible, with a link to the issue. |

On the site, every number has ✓ (verify) and ⚑ (flag) links that open a prefilled GitHub issue. `.github/workflows/verify.yml` turns the issue into a status-only edit (it never changes a value) through an auto-merged pull request. One verification is enough for `human-verified`, one flag is enough for `disputed`, and the GitHub account must be at least 6 months old. The repository owner does not act as verifier.

## Adding or extending a process

1. Read the coverage rule (`DECISIONS.md` #16, also on the site's About page): which measurements and predictions belong in a channel.
2. Edit or create `data/processes/<family>/<slug>.yaml`, following [`docs/data-model.md`](docs/data-model.md) and an existing file such as `data/processes/vector-bosons/dy-nc.yaml`. Every number needs a `provenance` with `ref` and `locator`, read from the source and not from memory.
3. Run the tool chain: `scripts.assign_uids`, `scripts.refs`, `scripts.machine_verify --apply`, `scripts.build --check --offline`.
4. Open a pull request.

[`CONTRIBUTING.md`](CONTRIBUTING.md) has the full steps, for people and for agents (`/draft-process`, `/crosscheck`, `/refresh`).

## CI and deployment

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main`: `pytest`, `npm test` (Node 22), `python -m scripts.build --check --offline`, and, only when `data/**` changed, `scripts.machine_verify` (report-only) and `scripts.linkcheck`.

`.github/workflows/pages.yml` runs on pushes to `main` (and manually): it builds `site/data.json` with `--offline` and deploys `site/` to GitHub Pages at `https://opensigma-hep.github.io/opensigma/`. The repo owner must first complete the Task 0 settings (create the `opensigma-hep` org and `opensigma` repo, set Pages source to "GitHub Actions"); neither workflow has been run live yet.

`.github/workflows/verify.yml` handles the site's ✓/⚑ issue forms (`.github/ISSUE_TEMPLATE/{verify,flag}.yml`): it applies a status-only edit through an auto-merged bot PR (verify PRs say `Closes #n`; flag PRs say `Refs #n`, so the dispute issue stays open for its maintainer). Owner setup: a GitHub App with secrets `BOT_APP_ID` / `BOT_PRIVATE_KEY`; "Allow auto-merge" on, with branch protection on `main` requiring `ci`; the issue labels `verify` and `flag` must exist; and the repo variable `FLAG_ASSIGNEE` (a GitHub user, used when a family has no `maintainers` in `data/families.yaml`, since an org owner cannot be assigned). Without `FLAG_ASSIGNEE` an unassigned flag just gets a comment.

Releases are cut by hand: see [`RELEASING.md`](RELEASING.md).

## Licence and citation

Code is MIT (`LICENSE`); data is CC BY 4.0 (`data/LICENSE`). Citation metadata is in `CITATION.cff`. Once a release exists, the site footer offers a "Cite this version" BibTeX entry with its DOI. Please also cite the original papers; the observable pages have a "Copy BibTeX" button for them.
