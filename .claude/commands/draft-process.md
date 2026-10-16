---
description: Draft or extend one process's YAML (or incorporate one INSPIRE candidate), every number fetched from its source
argument-hint: <proc:id | INSPIRE recid of a candidate>
---

# /draft-process $ARGUMENTS

You draft pheno-map data as an agent. The owner starts this command by hand, or `/refresh` starts it in a subagent. It never runs on a schedule. Work from the repo root and use `.venv/bin/python` for every script.

The argument `$ARGUMENTS` is either:
- a process id (`proc:...`): draft that process, or bring it up to the coverage rule, in `data/processes/<family>/<slug>.yaml`; or
- an INSPIRE recid (digits, optionally written `inspire:<digits>`): a candidate from `data/candidates.json`. The process key it is listed under says which process to update.

## 1. Read first (always, even if you think you know them)

1. `DECISIONS.md`: all of it. #16 (coverage rule), #17 (verification) and #11–#15 (uncertainties, size encoding, orders, refs/ids, projections) are binding.
2. `data/schema/*.json`: the YAML must validate against `process.schema.json` (+ `common.schema.json`), `amplitude.schema.json` and `parameter.schema.json`.
3. The gold-standard process `data/processes/vector-bosons/dy-nc.yaml`, and copy its shape and level of detail. If it does not exist yet, use `tests/fixtures/repo_min/processes/vector-bosons/dy-nc.yaml` as a shape example only (its numbers and refs are fake).
4. `data/families.yaml`, `data/colliders.yaml`, `data/hepdata_label_map.yaml`, the target process file if it exists, and `data/candidates.json`.

## 2. The one rule that matters

**Never write a number from memory.** Fetch every value, uncertainty, order and building-block claim from the source you cite, in this session, and fill `provenance.locator` with where exactly it is (`Table 3`, `Fig. 5, 66 < mll < 116 GeV`, `Sec. 4.2, eq. (12)`, `hepdata ... bin 2`). If you cannot fetch the source, or cannot find the number in it, leave the datum out and say so in your report. A plausible guess is worse than a gap.

Sources, in order of preference:
- HEPData tables: `.venv/bin/python -m scripts.ingest_hepdata ins<recid> "<Table name>" [--bin N]` prints a `results:` snippet with a `measurement: <MEAS-ID>` placeholder. Replace the placeholder with the real `meas:` id and keep its `source: hepdata` provenance.
- The paper: INSPIRE record `https://inspirehep.net/api/literature/<recid>`, and the arXiv HTML (`https://arxiv.org/html/<id>`) or abstract/PDF (`https://arxiv.org/abs/<id>`).

## 3. Write the YAML

- Follow the coverage rule (#16). Measurements per (channel, experiment, observable type): the most precise and recent one. Keep superseded ones still used in global fits, with `superseded_by`. Combinations get `experiment: combination`; preliminaries only when no paper exists (`preliminary: true`). Predictions per observable: the highest accuracy along each axis (QCD, EW, mixed, resummation, PS), plus every prediction the experiment compared to. Add intermediate steps only if they introduced a building block.
- Set `coverage: complete|partial|stub` and `last_reviewed: <today>` on every channel you touched.
- Every datum gets `provenance: {ref, locator, source, status, date}`. Use `source: agent` and `status: agent-draft` for everything you extracted yourself, and `source: hepdata` for `ingest_hepdata` output. `date` is today. Leave `uid` out: step 4 assigns it. Never set `verified_by` or `issue`.
- Refs use the formats `inspire:<recid>`, `arXiv:<id>`, `hepdata:ins<recid>/<table name>`, and `arXiv:<id>, <locator>` for figures.
- Ids are stable slugs (`proc: chan: meas: obs: amp: par:`). Never rename an existing id. If you must rename, keep the old one in `aliases:`.
- Never store derived values (precision ratio, max order, process status, stats).
- Do not change any datum whose status is above `agent-draft` (`cross-checked`, `machine-verified`, `human-verified`, `disputed`). If its source disagrees with it, report the disagreement instead of editing it.
- New processes get a `watch:` block: `recids:` (key papers whose citations signal new results) and `queries:` (INSPIRE search strings). Leave `last_run` out.

**Candidates** (`data/candidates.json`, `{proc_id: [{recid, title, arxiv, matched_by, channels?}]}`):
- When you incorporate a candidate, remove its entry. It is now cited, and `scripts.candidates` would drop it anyway.
- When a candidate belongs in a channel but you did not incorporate it, set `"channels": ["chan:..."]` and say why in your report. The site counts it there as "not yet incorporated".
- When the coverage rule says it does not belong anywhere, set `"channels": []`. It is then counted nowhere.

## 4. Run the tool chain, in this order

```bash
.venv/bin/python -m scripts.assign_uids data
.venv/bin/python -m scripts.refs --root data
.venv/bin/python -m scripts.machine_verify --root data --apply
.venv/bin/python -m scripts.build --root data --check --offline
```

`scripts.refs` resolves new refs online and caches them in `data/refs.json`. `machine_verify --apply` re-fetches every `source: hepdata` datum and promotes matches to `machine-verified`.

**Stop on the first failure**, whether a non-zero exit, an unresolved ref, a HEPData mismatch or a schema/integrity error. Do not "fix" a number to make a check pass, and do not continue to later steps. Report the failing command and its output.

## 5. Report

Do not commit, push or open PRs: the owner or `/refresh` does that. End with a short report that lists:
- the files changed;
- the uids added or changed;
- every source fetched, as ref and URL;
- data you left out and why;
- candidates you tagged, and their channels;
- the result of each tool-chain command.
