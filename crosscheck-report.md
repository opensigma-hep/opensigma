# Cross-check report: NC Drell–Yan (Task 18)

Date: 2026-10-16. Verdicts were recorded in the session workspace.

| Group | Checked | Agree (set to cross-checked) | Disagree |
|-------|---------|------------------------------|----------|
| G1 | 105 | 105 | 0 |
| G2 | 44 | 42 | 2 |
| G3 | 83 | 80 | 3 |
| Total | 232 | 227 | 5 |

Disagreements (all still `agent-draft`, except the two ResBos predictions, which were removed):

- 08c7b05e — accuracy.qcd was NNLO, but D0 states the prediction has an NNLO total σ and an NLO differential distribution (arXiv:1006.0618); locator cited [10], the arXiv text cites [2] — set qcd NLO with a note on the NNLO normalisation, locator now [2] and the NLO statement — corrected after cross-check; still agent-draft, needs re-check.
- 99e8da7a — CMS 2011 FEWZ is only claimed at O(αs) and O(αs²) for qT > 20 GeV, never called NNLO — relabelled NLO for the distribution with a note, locator now Sec. 6 / Fig. 8 — corrected after cross-check; still agent-draft, needs re-check.
- 54600acd — LHCb 2016 has no ResBos vs pT(Z) comparison (only generators; ResBos is not in the paper) — prediction removed after cross-check.
- dfe86b8b — LHCb 2016 has no ResBos vs φ* comparison — prediction removed after cross-check.
- 7955c7b5 — code was unidentified, but Sec. 2 names DYNNLO v1.3 (cross-checked with FEWZ v3.1.b2) — codes set to DYNNLO v1.3, false "code not identified" note removed, locator now Sec. 2 plus abstract — corrected after cross-check; still agent-draft, needs re-check.

## Relabelled after review (order convention)

`accuracy.qcd` is the order of the observable predicted: fixed-order O(αs²) for a distribution that vanishes at Born level (pT(ℓℓ), φ*, A_i) is `NLO`, with NNLO only for the inclusive normalisation. Now agent-draft, needs re-check:

- 9a76af16 — CDF 2012 pT(ee), FEWZ2: NNLO → NLO
- c6047625 — ATLAS 2014 pT(ℓℓ), FEWZ/DYNNLO: NNLO → NLO
- 1a1d17e4 — CMS 2019 pT(ℓℓ), FEWZ (pT > 32 GeV): NNLO → NLO
- 314f78fc — CMS 2015 qT, FEWZ 3.1.b2 + NLO EW: NNLO → NLO
- 632325ae — ATLAS 2016 pT/φ*, DYNNLO 1.3 + NLO EW: NNLO → NLO
- ca24781e — CDF 2011 A_i vs pT, FEWZ: NNLO → NLO
- 16bb392d — CMS 2015 A_i, FEWZ: NNLO → NLO
- 7955c7b5 — ATLAS 2016 A_i, DYNNLO v1.3 (was already agent-draft): NNLO → NLO
- 2026-10-16 f5940fa3 data/amplitudes/1L-qqbar-V.yaml evaluation: stored analytic / "one-loop massless quark form factor in closed form", re-extracted no analytic/closed-form/form-factor statement (abstract: dim-reg O(αs) calculation, numerical phenomenology) from inspire:140456, Abstract — detail not supported at locator
- 2026-10-16 11502e24 data/amplitudes/2L-qqbar-ll-qcdew.yaml evaluation: stored analytic / "...; Armadillo et al. 2022: 5 two-mass masters by DE series expansion", re-extracted analytic / box masters as multiple polylogarithms in physical regions from inspire:1836186, Sec. 1 — Armadillo et al. claim not supported at locator (different paper, 2022)
- 2026-10-16 cf004c51 data/amplitudes/3L-qqbar-V.yaml evaluation: stored analytic / "finite parts of A9,2, A9,4 fixed by numerics + PSLQ (Lee–Smirnov–Smirnov 2010)", re-extracted analytic / IBP reduction to known masters, ζ-value expansions, A9,2/A9,4 analytic result of ref [41]; this paper's MB numerics + PSLQ only cross-check (PSLQ unique for poles, insufficient precision for finite parts) from inspire:852545, Sec. 1 and Sec. 4 — PSLQ-fixed-finite-parts claim not supported
