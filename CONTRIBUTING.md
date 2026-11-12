# Contributing to OpenSigma

There are three ways to help, in increasing order of effort: verify or flag numbers on the site, edit the data by hand, or draft data with the agent commands. All of them end in a pull request that CI validates.

The one rule behind everything: **a number is only as good as its locator.** Every value must be read from the cited source, in the place the locator names, and never written from memory.

## 1. Verify or flag a number (no setup)

1. On the site, find a number you can check against its paper or HEPData record. Its badge shows the current status; hover over the badge for the reference and locator.
2. Open the source, go to the locator, and compare.
3. Click ✓ if it is right, or ⚑ if the value, the locator or the category is wrong or unclear. Either opens a prefilled GitHub issue. Leave the prefilled fields as they are, write in the comment what you checked (and, for a flag, what you found instead), and submit.

A GitHub Action then opens a status-only pull request and merges it once CI passes. A verification sets `status: human-verified` and `verified_by: <your login>`; a flag sets `status: disputed` and links your issue, and the issue stays open for the family maintainer. No value is changed by either.

Conditions: your GitHub account must be at least 6 months old, and you cannot verify the same datum twice. One verification or one flag is enough to change the status. Verifying a disputed datum resolves the dispute.

## 2. Edit the data by hand

### Setup

```bash
python3 -m venv .venv
.venv/bin/pip install -e '.[dev]'
```

### What to edit

The data is YAML under `data/`; [`docs/data-model.md`](docs/data-model.md) documents every field. Start from an existing file: `data/processes/vector-bosons/dy-nc.yaml` is the reference example.

- A process lives in `data/processes/<family>/<slug>.yaml`, and the folder must match its `family`.
- Follow the coverage rule (`DECISIONS.md` #16): per channel, experiment and observable type, the most precise or most recent measurement; per observable, the highest accuracy along each axis (QCD, EW, mixed, resummation, parton shower) plus every prediction the experiment compared to. Set the channel's `coverage` and `last_reviewed`.
- Ids (`proc:`, `chan:`, `meas:`, `obs:`, `amp:`, `par:`) are permanent. Do not rename one; if you must, keep the old id in `aliases`.
- Do not store derived values (ratios, highest order, counts). The build computes them.

### The provenance rule

Every datum has a `provenance` record:

```yaml
provenance: {ref: "inspire:2022440", locator: "Table 3, row 'Total'", source: human, status: agent-draft, date: "2026-11-12"}
```

- `ref`: `inspire:<recid>`, `arXiv:<id>` or `hepdata:ins<recid>/<table name>`.
- `locator`: where exactly the value is: table and row, figure and bin, equation, or section. Someone else must be able to find the number from it.
- `source`: `human` for values you read yourself, `hepdata` for output of `scripts.ingest_hepdata`, `agent` for agent drafts.
- `status`: `agent-draft`, the lowest level, for anything new. The status vocabulary has no separate level for a human draft; `source: human` records that a person entered it. `human-verified` and `verified_by` are set by the verify workflow when someone confirms the value through the ✓ link, not by hand.
- `date`: today.
- `uid`: leave it out. `scripts.assign_uids` adds it.

If the source disagrees with a stored value whose status is `cross-checked`, `machine-verified` or `human-verified`, flag it (⚑) or explain the correction in the pull request, and set the corrected value's status back to `agent-draft` so that it is checked again.

For experimental numbers with a HEPData record, let the script do the reading:

```bash
.venv/bin/python -m scripts.ingest_hepdata ins1234567 "Table 5" --bin 3
```

It prints a `results:` snippet and writes no file: the total (quadrature sum of all errors, in the given bin or the minimum over bins), the breakdown by category from `data/hepdata_label_map.yaml`, and `source: hepdata` provenance. Paste it under the observable and replace the `<MEAS-ID>` placeholder with the measurement id.

### Run the tool chain

In this order, stopping at the first failure:

```bash
.venv/bin/python -m scripts.assign_uids data                         # add missing provenance uids
.venv/bin/python -m scripts.refs --root data                         # resolve new references, update data/refs.json (online)
.venv/bin/python -m scripts.machine_verify --root data --apply       # re-fetch HEPData values; matches become machine-verified (online)
.venv/bin/python -m scripts.build --root data --check --offline      # schema and integrity checks
.venv/bin/pytest -q
npm test
```

To look at the result, build and serve the site:

```bash
.venv/bin/python -m scripts.build --offline
python3 -m http.server -d site
```

Do not adjust a number to make a check pass. If `machine_verify` reports a mismatch or a reference does not resolve, the data is wrong or the source moved; find out which.

### Open a pull request

Commit the YAML together with the updated `data/refs.json`. CI runs `pytest`, `npm test` and `scripts.build --check --offline`, and for data changes also `scripts.machine_verify` (report-only) and `scripts.linkcheck`.

Changes to the site or the scripts follow the same route. The site is plain ES modules under `site/js/` with tests in `site/test/`; a label shown to users needs an entry in `site/js/glossary.js` (a test checks the fixed vocabularies). Record design changes as a new numbered entry in `DECISIONS.md`.

## 3. Draft data with agents

The repository ships three Claude Code commands in `.claude/commands/`. They are started by hand and never run on a schedule or in CI.

| Command | What it does |
| --- | --- |
| `/draft-process <proc:id \| INSPIRE recid>` | Drafts or extends one process file, or incorporates one candidate paper. It fetches every number from its source in that session, writes `source: agent`, `status: agent-draft` provenance, and runs the tool chain above. It does not commit. |
| `/crosscheck [uid ...]` | The independent second read. In a fresh context it lists the `agent-draft` data changed against `main` with their values hidden, re-extracts each from its locator, and only then compares. Agreement within rounding becomes `cross-checked`; anything else stays `agent-draft` and gets a line in `crosscheck-report.md`. It does not commit. |
| `/refresh [fam:id \| proc:id]` | Owner only. Searches INSPIRE for new papers using each process's `watch:` block, updates `data/candidates.json`, runs `/draft-process` per candidate and one `/crosscheck`, validates, and opens an auto-merging pull request. |

Rules the agents follow, and that you should check when reviewing their output:

- No number from memory. If the source cannot be fetched or the number cannot be found, the datum is left out and reported.
- An agent never sets `human-verified`, `verified_by` or `issue`, and never edits a datum whose status is above `agent-draft`.
- The cross-checking agent must not see the drafting agent's notes or values before it has made its own extraction.
- Candidates that were looked at and do not belong anywhere get `"channels": []` in `data/candidates.json`; candidates that belong in a channel but were not incorporated get that channel's id, and the site counts them there.

Agent-drafted and cross-checked data are published as such: the status badge tells readers that no person has checked the value. Human verification through the ✓ link is what moves it further.

## Disputes and maintainers

A flag is assigned to the maintainers listed for the family in `data/families.yaml`, or to the fallback account configured by the repository owner when the family has none. To volunteer as a family maintainer, open an issue.
