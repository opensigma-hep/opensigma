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

## Families v1 (PR #5)

- 2026-10-17 67f56ae5 data/processes/higgs/vh.yaml channels/chan:vh/lhc-13/observables/obs:vh/lhc-13/sigma-wh/predictions/NNLO QCD + NLO EW (LHC Higgs Working Group, YR4), m_H = 125 GeV/uncertainties/MHOU: stored range=[0.5, 0.7], re-extracted range_pct={'minus': 0.7, 'plus': 0.5} from arXiv:1610.07922, Table 223, 13.0 TeV row; scale variation described in Sec. I.5.2.c — numbers agree, but YR4 Sec I.5.2.c says mu_R and mu_F are 'varied independently' in M_VH/3<mu<3 M_VH, contradicting the stored specific 'mu_R = mu_F variation'
- 2026-10-17 0af57a1a data/processes/higgs/vh.yaml channels/chan:vh/lhc-13/observables/obs:vh/lhc-13/sigma-zh/predictions/NNLO QCD + NLO EW (LHC Higgs Working Group, YR4), m_H = 125 GeV/uncertainties/MHOU: stored range=[3.1, 3.8], re-extracted range_pct={'minus': 3.1, 'plus': 3.8} from arXiv:1610.07922, Table 225, 13.0 TeV row; scale variation described in Sec. I.5.2.c — numbers agree, but YR4 Sec I.5.2.c says mu_R and mu_F are 'varied independently' in M_VH/3<mu<3 M_VH, contradicting the stored specific 'mu_R = mu_F variation'
- 2026-10-17 c5dcb595 data/processes/jets-alphas/inclusive-jets.yaml channels/chan:inclusive-jets/lhc-13/observables/obs:inclusive-jets/lhc-13/d2sigma-dpt-dy/predictions/NNLO QCD full colour (NNLOJET), μ = pT, ⊗ NP: stored label mu = pT, NP applied, re-extracted {"qcd": "NNLO", "colour": "full", "obs": "single jet inclusive doubly differential pT,|y|", "compared": "CMS 13 TeV 1605.04436"} from inspire:2070536, Abstract and Sec. 3 (single jet inclusive doubly differential in pT and |y| at NNLO full colour, compared with CMS 13 TeV [1605.04436]) — 2204.10173 Sec 3.1: central scale is H_T-hat (scalar sum of parton pT), not jet pT; single-jet prediction is parton-level NNLO, no NP corrections applied (NP only applied in the dijet 3D section, p.~25)
- 2026-10-17 c9e63280 data/processes/top/t-channel-single-top.yaml channels/chan:t-channel-single-top/lhc-13/observables/obs:t-channel-single-top/lhc-13/sigma-t/predictions/NLO QCD (HatHor 2.1, 5FS), CMS 2019 comparison/uncertainties/PDF: stored {"category": "PDF", "specific": "PDF and αS(mZ) uncertainty (MSTW2008 68% CL NLO)", "pdf_set": "MSTW2008nlo68cl", "size": {"range": [2.6, 2.6], "unit": "%", "asymmetric": false}}, re-extracted {"range": [2.57, 2.57], "unit": "%", "pdf_set": "MSTW2008 68% CL NLO (plus CT10, NNPDF2.3 via PDF4LHC prescription)"} from inspire:1712748, Sec. 1, Eq. (1): ± 3.5 pb (PDF+αS) of 136.0 pb — pdf_set 'MSTW2008nlo68cl' is a single-set attribution; source says PDF+alphaS uncertainty computed with MSTW2008, CT10 and NNPDF2.3 via the PDF4LHC prescription (three-set envelope). Numeric 2.6% agrees.
- 2026-10-17 aa234a05 data/processes/vector-bosons/wz.yaml channels/chan:wz/lhc-13/observables/obs:wz/lhc-13/sigma-tot/results/meas:wz/lhc-13/cms-2022-tot/total: stored {"value_pct": 3.8}, re-extracted {"quoted_total_1.9pb": 3.755, "quad_with_syst1.5": 4.122, "quad_with_syst1.4": 3.982} from inspire:1949191, Summary: σ_tot(pp → WZ) = 50.6 ± 0.8 (stat) ± 1.4 (syst) ± 1.1 (lum) ± 0.5 (thy) = 50.6 ± 1.9 pb (the table of total cross sections lists the syst component as 1.5 pb) — CMS WZ 2110.11231 internally inconsistent: abstract/Table 6 give syst 1.5 pb, Summary gives syst 1.4 pb and total 50.6±1.9; quadrature of components gives 2.09 (1.5) or 2.01 (1.4) pb, i.e. 4.1% or 4.0%, not 1.9 pb (3.8%). Stored 3.8% depends on which number is taken.
- 2026-10-17 e0a80dce data/processes/vector-bosons/wz.yaml channels/chan:wz/lhc-13/observables/obs:wz/lhc-13/sigma-tot/results/meas:wz/lhc-13/cms-2022-tot/uncertainties/other: stored {"category": "other", "specific": "Experimental systematics excluding luminosity (combined)", "size": {"range": [3.0, 3.0], "unit": "%", "asymmetric": false}}, re-extracted {"pct_table6_1.5": 2.964, "pct_summary_1.4": 2.767} from inspire:1949191, Table of measured total cross sections, Combined: ± 1.5 (syst) of 50.6 pb — CMS WZ 2110.11231: syst is 1.5 pb in abstract and Table 6 (2.96% -> 3.0 stored) but 1.4 pb in Summary (2.77% -> 2.8). Value depends on which number is taken.

### Agreed, with caveats (locator slips, rounding from quoted totals)

- heavy-flavour: locators of 0252a980 d07b54cf 1ce21961 d8bc9d32 4af1c517 say 'Sec. 6'; in arXiv:2308.04877 Eq. (4)/Fig. 13 are in Sec. 5.4.4 (values agree with Eq. 4)
- z-pole 246539a1/7138d040: stored 0.0145% = paper's quoted total 6 pb / 41489.6 pb; quadrature of the four listed components gives 5.60 pb (0.0135%). 7138d040 locator cites "eq. (5.1)"; ansatz is eq. (27).
- top 5581ca65: "5FS" supported by the datum's refs abstract (inspire:1834626), not by the locator's ATLAS Sec. 3.1.
- photons: visible strings not supported at locator (not hidden claims): 5ab96f3d (MCFM dynamical-cone claim is from inspire:1727794), 4dcbeda5/23c49686/9c7515a9 ("no EW corrections" not mentioned in 2302.00510); b128e275 locator "ref. [7]" should be refs. [46],[3]; ed989e89 range [0,3] is from "less than 3%".
- vector-bosons 60b36b6d: 2.6% = ATLAS ZZ quoted total ±1.3 fb; quadrature of rounded components gives 2.8%.
