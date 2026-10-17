# OpenSigma (formerly pheno-map) — design decisions log

Running record of decisions from the design grilling. Nothing is built until the design is confirmed.

## Purpose
Interactive map of phenomenologically interesting collider processes, for theorists:
what is experimentally available, what theory has achieved, and referenced sources of
uncertainty — repeated per observable.

## Decisions
1. **Scope — colliders:** all colliders (LEP, Tevatron, HERA, LHC, future: FCC-ee, EIC, muon collider, ...).
   Consequence: physics *process* is collider-agnostic; per-collider measurements hang off it.
2. **Scope — physics:** SM only for now. BSM is a likely future extension — schema must not preclude it.
3. **Location:** everything lives in `pheno-map/`.
4. **Hierarchy:** Family → Process → Channel (collider, √s, initial state) → Measurement → Observable.
   - Top level is a *family* (e.g. vector-boson production). Entering a family opens a new map of its processes (zoomable/nested maps).
   - Theory status lives at two levels: process-level (inclusive) and observable-level (incl. resummation, non-pert., observable-specific gaps).
   - Uncertainty breakdowns (exp + theory, each with value/method/ref) repeated per observable.
5. **Theory building blocks:** track which ingredients exist (virtuals, reals, real-virtual, subtraction, ...) — structure TBD (Q4).
   **Resolved (Q4):** per-process matrix, rows = perturbative orders (NLO QCD, NNLO QCD, NLO EW, mixed QCD×EW, N3LO, ...),
   columns = Born | 1L | 2L | 3L | RV | RR | RRR | IR scheme | combined/public code.
   Cells: status (done / partial / missing) + approximations (leading colour, planar, m_t→∞, ...) + refs.
   Loop amplitudes live in a **shared amplitude library** (partonic, crossing-aware), referenced by ID from process matrices;
   UI gets reverse lookup (amplitude → processes/colliders using it). Master integrals = a field on library entries, as is
   `evaluation`: analytic | semi-analytic (masters partly by series expansion/numerics) | numerical (grid or numerical pipeline) + one-line detail.
   Resummation ingredients (anomalous dims, soft/jet/beam functions) = separate block, attached at observable level.
6. **Provenance (Q5):** hybrid. Experimental side ingested from HEPData/INSPIRE by script; theory side agent-drafted + human-verified.
   Every datum carries {value, ref, locator, source: hepdata|agent-draft|human, status: unverified|verified, verified_by, date}.
   Unverified content is shown publicly, visibly badged. ~~Verifier: the user~~ → superseded by #17 (no owner verification).
7. **Delivery (Q6):** data-as-code static site on **GitHub** (Pages).
   `data/` YAML + JSON Schema · `scripts/` Python (ingest, validate, link-check) · `site/` plain HTML/JS + D3, build merges YAML → JSON.
   Versioned releases citable. Artifact previews during development.
8. **Map encoding (Q7):** family view = process × (collider, √s) matrix; colouring switchable between
   highest perturbative order (default) and theory÷exp precision ratio (hatched when unquantified);
   toggle to exp-vs-theory precision scatter. Top level = family tiles with summary stats.
9. **No v1 cuts (Q8):** user rejected all simplifications. Full structure kept: all families, Measurement level,
   two-level theory status, fixed building-block ingredient columns, HEPData/INSPIRE ingestion script,
   separate ingest/validate/link-check scripts, D3 frontend.
10. **Families (Q9):** Vector bosons · Top · Higgs · Jets & αs · e+e− hadronic · EW precision · Photons ·
    Heavy-flavour production · DIS. Excluded: soft QCD/min-bias, heavy ions, flavour decays, γγ/UPC.
    Process has one primary `family` + optional `also_in: [...]` (shown in each map, single data file).
    New entity **Parameter** (m_W, m_t, αs, sin²θ_eff, ...) linking to the observables it is extracted from.
11. **Uncertainty vocabulary (Q10):** two-level — fixed `category` enum (schema-enforced) + free `specific`.
    Theory: MHOU(method) · PDF(pdf_set) · alphas · parametric · nonpert(method) · matching_shower(method) ·
    EW_missing · approximation · numerical. Exp: stat · lumi · energy_scale · efficiency · unfolding_model ·
    background · acceptance_extrapolation · beam · pileup · syst_combined (source quotes only a combined systematic; added 2026-10-17) · other (build warns on `other`).
    HEPData label → category needs a mapping table in the ingest script.
12. **Uncertainty numbers (Q11):** summary + link. Each entry: category, specific, method, size {range [min,max] %,
    optional regions [{where, value}], asymmetric}, full_table (hepdata:… or arXiv figure locator), provenance.
    Relative % by default, absolute only with explicit unit. Exp arrays not copied — ingest derives `range`.
    Each channel designates a headline observable + headline region for ratio colouring / scatter.
13. **Theory side (Q12):** observable holds a list of `Prediction`s. Each: structured accuracy {qcd, ew, mixed,
    resummation(+variable), shower_matched, approximations}, codes, uses_amplitudes (→ library), uncertainties,
    compared_to (→ measurements), refs, provenance, optional `headline: true`.
    Derived (never stored): cell order colour = max QCD order; ratio/scatter use headline prediction;
    process-level theory status = predictions on headline observable; amplitude ↔ prediction reverse links.
14. **Refs, IDs, layout (Q13):** INSPIRE recid canonical (`inspire:…`; `arXiv:…` accepted, resolved at build);
    `hepdata:insNNN/tK` for tables. Build caches metadata/BibTeX in committed `data/refs.json`; per-page "copy BibTeX".
    Stable slug IDs (proc:/chan:/meas:/obs:/amp:), deep-linkable via URL hash, never change; `aliases:` on rename.
    Layout: data/families.yaml · processes/<family>/<process>.yaml (inline channels→…→predictions) ·
    amplitudes/ · parameters/ · refs.json · schema/. Split big processes by channel if needed.
15. **Projections (Q14):** future/HL measurements = `Measurement` with `projected: true`, required projection_source
    (INSPIRE ref + date), optional assumptions; visually distinct; ratio colouring uses them only with
    "include projections" toggle. Optional `theory_target` {required_total, current_total, source} per observable.
    HL-LHC = its own column (`lhc-hl`). Multiple dated projections allowed (list).
16. **Coverage rule (Q15, published on About page):**
    Measurements per (channel, experiment, observable type): most precise/recent; superseded ones still used in
    global fits (flag `superseded_by`); combinations as own Measurement (`experiment: combination`);
    preliminary only if no paper (`preliminary: true`).
    Predictions per observable: highest accuracy along each axis (QCD, EW, mixed, resum, PS) + any prediction the
    experiment compared to. Intermediate steps only if they introduced a building block.
    Per channel `coverage: complete|partial|stub` + `last_reviewed`; partial cells drawn with distinct texture.
17. **Verification (Q16 revised) — owner does NOT verify.**
    Status ladder: agent-draft → cross-checked (2nd independent agent re-extraction from locator agrees) /
    machine-verified (CI re-fetches HEPData value, matches) → human-verified → disputed.
    Users verify via ✓/⚑ buttons → prefilled GitHub issue → GitHub Action opens status-only PR
    (status + verified_by), schema-validated, auto-merged. Identity = GitHub account (>6 months old).
    Thresholds: 1 verify → human-verified (badge shows who); 1 flag → disputed (red, links issue, value stays).
    Disputes: per-family volunteer maintainers in families.yaml (auto-assigned); owner is fallback until they exist.
    Pipeline: NC-DY gold-standard process first (cross-checked, not human-verified) → one agent per process,
    every number fetched from source, schema rejects numbers without `locator` → one PR per process.
    Family order: Vector bosons, Top, Higgs, Jets&αs, EW precision, e+e− hadronic, DIS, Photons, Heavy flavour.
18. **Freshness (Q17):** monitoring + drafting done by agents, **triggered manually by the owner**, never scheduled.
    Mechanism: repo-local Claude Code command (`/refresh [family|process]`) runs on the owner's machine/subscription
    (no API key in repo secrets): queries INSPIRE per process `watch:` list (key recids + search queries since
    last run) → candidate list → one agent per candidate drafts YAML → second agent cross-checks → opens PR;
    CI validates; auto-merge on green. Site shows "N candidate papers not yet incorporated" per cell from last run.
    Channels with last_reviewed > 18 months show "may be outdated".
19. **License & citation (Q18):** data CC-BY 4.0, code MIT. Zenodo DOI per release via GitHub integration;
    releases cut manually by owner (e.g. v2026.11). Footer "cite this version" BibTeX (version + concept DOI).
    CITATION.cff in repo. Verifiers + family maintainers auto-listed as Zenodo contributors.
20. **Repo (Q19):** name **OpenSigma** (renamed from the placeholder pheno-map on 2026-10-16). GitHub organisation
    `opensigma-hep` (`opensigma` and `open-sigma` were unavailable). Repo github.com/opensigma-hep/opensigma → served at
    opensigma-hep.github.io/opensigma/ (site uses relative paths + hash routing, so a later move to the bare org URL works).
    Setup step: install `gh` CLI for /refresh PRs (installed 2026-10-16).
21. **Leaf (observable) page (Q20):** header (breadcrumb, coverage, last_reviewed, candidate count, deep link,
    copy-BibTeX) · headline strip (theory vs exp total vs theory_target) · measurements table · side-by-side
    exp/theory stacked uncertainty bars by category, expandable to specific/method/range/regions/locator, with
    status badge + ✓/⚑ per number · predictions list with accuracy chips · process building-block matrix (collapsed).
    Site-wide: client-side global search, matrix filters (collider, accuracy, status, has-target), light/dark,
    keyboard + screen-reader accessible, desktop-first (matrix scrolls horizontally on mobile).
22. **BSM extension point (default):** `sector: SM` field on families/processes; BSM later = new sector value +
    its own families, no schema restructuring.
