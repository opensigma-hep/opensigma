---
description: Owner-run refresh — find new INSPIRE candidates, draft them, cross-check, open an auto-merging PR
argument-hint: "[fam:id | proc:id] (default: all watched processes)"
---

# /refresh $ARGUMENTS

**Only the repo owner runs this, by hand, on their own machine** (DECISIONS.md #18). It never runs on a schedule, in CI, or from a hook, and you must not set up anything that would run it automatically. Work from the repo root and use `.venv/bin/python` for every script.

Scope: `$ARGUMENTS` is a family id (`fam:...`), a process id (`proc:...`), or empty for every process with a `watch:` block. Below, `<scope>` is the id with its prefix stripped and `/`→`-` (for example `dy-nc`, `vector-bosons`), or `all`. `<date>` is today as `YYYY-MM-DD`.

## Steps

0. Preconditions: `git status --porcelain` is empty and `gh auth status` succeeds. Otherwise stop and report.
1. **Find candidates:**
   ```bash
   .venv/bin/python -m scripts.candidates --root data $ARGUMENTS
   ```
   This searches INSPIRE since each process's `watch.last_run` (default: 5 years). It prints `{proc_id: [{recid, title, arxiv, matched_by, channels?}]}`, updates `data/candidates.json` and each `watch.last_run`. If it fails, stop and report. Candidates that already carry a `channels` tag were triaged in an earlier run: skip them unless the owner asks otherwise.
2. **Draft:** for each remaining candidate, one at a time, start a **subagent** that runs `/draft-process <recid>` (the instructions in `.claude/commands/draft-process.md`). Each subagent fetches every number from its source and runs the tool chain itself. If a subagent reports a failure, stop the whole refresh and report it. Do not continue with half-drafted data.
3. **Cross-check:** start **one new subagent in a fresh context** that runs `/crosscheck` (`.claude/commands/crosscheck.md`) with no arguments. Give it nothing from the drafting subagents: it lists the changed uids itself from the diff against `main`.
4. **Validate:**
   ```bash
   .venv/bin/python -m scripts.build --root data --check --offline
   .venv/bin/pytest -q
   ```
   Stop on failure.
5. **Branch, commit, PR:**
   ```bash
   git switch -c refresh/<date>-<scope>
   git add data crosscheck-report.md
   git commit -m "data: refresh <scope> (<date>)"
   git push -u origin refresh/<date>-<scope>
   gh pr create --fill --base main
   gh pr merge --auto --squash
   ```
   (`crosscheck-report.md` may not exist. Then leave it out of `git add`.) The PR body should list the candidates drafted, the counts of cross-checked vs agent-draft data, and any disagreements. CI validates, and auto-merge lands it when CI is green.

If step 1 finds no candidates, commit only the `watch.last_run` / `candidates.json` update through the same branch and PR flow.

## Report

The branch and PR URL, the candidates found, drafted and skipped, the cross-check counts, and any failure with the command and output that stopped the run.
