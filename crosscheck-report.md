# Cross-check report: NC Drell–Yan (Task 18)

Date: 2026-10-16. Verdict files: `.superpowers/sdd/2026-10-16-pheno-map/crosscheck-G{1,2,3}.jsonl`.

| Group | Checked | Agree (set to cross-checked) | Disagree |
|-------|---------|------------------------------|----------|
| G1 | 105 | 105 | 0 |
| G2 | 44 | 42 | 2 |
| G3 | 83 | 80 | 3 |
| Total | 232 | 227 | 5 |

Disagreements (all still `agent-draft`):

- 08c7b05e — accuracy.qcd was NNLO, but D0 states the prediction has an NNLO total σ and an NLO differential distribution (arXiv:1006.0618); locator cited [10], the arXiv text cites [2] — set qcd NLO with a note on the NNLO normalisation, locator now [2] and the NLO statement — corrected after cross-check; still agent-draft, needs re-check.
- 99e8da7a — CMS 2011 FEWZ is only claimed at O(αs) and O(αs²) for qT > 20 GeV, never called NNLO — relabelled NLO for the distribution with a note, locator now Sec. 6 / Fig. 8 — corrected after cross-check; still agent-draft, needs re-check.
- 54600acd — LHCb 2016 has no ResBos vs pT(Z) comparison (only generators; ResBos is not in the paper) — prediction removed — corrected after cross-check; still agent-draft, needs re-check.
- dfe86b8b — LHCb 2016 has no ResBos vs φ* comparison — prediction removed — corrected after cross-check; still agent-draft, needs re-check.
- 7955c7b5 — code was unidentified, but Sec. 2 names DYNNLO v1.3 (cross-checked with FEWZ v3.1.b2) — codes set to DYNNLO v1.3, false "code not identified" note removed, locator now Sec. 2 plus abstract — corrected after cross-check; still agent-draft, needs re-check.
