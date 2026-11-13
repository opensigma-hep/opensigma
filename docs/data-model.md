# Data model

This is the field-by-field reference for the YAML files under `data/`. It follows the JSON Schemas in `data/schema/`, which are the authority: if this page and a schema disagree, the schema is right and this page needs fixing. Every example is copied from `data/`; a line `# …` marks where part of the file was left out.

All objects reject unknown keys (`additionalProperties: false`). "Required" means the schema rejects the file without it. Run `python -m scripts.build --check --offline` to validate.

## Overview

```
data/families.yaml                    list of families                       families.schema.json
data/colliders.yaml                   list of colliders                      colliders.schema.json
data/processes/<family>/<slug>.yaml   one process per file                   process.schema.json
data/amplitudes/<slug>.yaml           one loop amplitude per file            amplitude.schema.json
data/parameters/<slug>.yaml           one parameter per file                 parameter.schema.json
data/schema/common.schema.json        shared definitions: id, ref, provenance, size, uncertainties, total, accuracy, theory_target
```

Hierarchy inside a process file:

```
Process
├─ building_blocks[]        row (perturbative order) → cells (one per ingredient)
└─ channels[]               the process at one collider
   ├─ measurements[]        experimental analyses
   └─ observables[]
      ├─ results[]          one per measurement that measured this observable: total + uncertainties
      ├─ predictions[]      theory calculations: accuracy, total, uncertainties
      ├─ resummation_ingredients[]
      └─ theory_target
```

Measurements and observables are siblings under a channel. A result ties them together: it sits under an observable and names its measurement by id.

## Shared definitions (`common.schema.json`)

### Ids

A string `<prefix>:<slug>`, with prefix one of `fam`, `proc`, `chan`, `meas`, `obs`, `amp`, `par`, `col`. The slug starts with a letter or digit and may contain letters, digits and `. / + -`. Each field that holds an id also fixes its prefix (a `family` must start with `fam:`, and so on).

Ids are permanent: they are the URLs of the site (`#/proc:dy-nc`). When an object must be renamed, the old id goes into its `aliases` list and the site redirects. Ids and aliases share one namespace and must be unique across all files. A reference from one object to another must use the id, not an alias.

### References (`ref`)

A string in one of three forms:

| Form | Example |
| --- | --- |
| `inspire:<recid>` | `inspire:2022440` |
| `arXiv:<id>`, new style (`1234.56789`) or old style (`hep-ph/0703273`), optionally followed by `, <locator>` | `arXiv:2103.05419` |
| `hepdata:ins<recid>/<table name>` | `hepdata:ins1802096/Table 1` |

The build resolves each INSPIRE and arXiv reference once and caches its metadata and BibTeX in `data/refs.json`.

### `provenance`

Where a datum comes from and how far it has been checked. Every number and every claim has one.

| Field | Required | Type | Meaning |
| --- | --- | --- | --- |
| `uid` | yes | 8 lowercase hex digits | Unique handle of the datum, used by the verify/flag issues. Do not write it by hand: `python -m scripts.assign_uids data` adds it. Must be unique across all files. |
| `ref` | yes | ref | The source. |
| `locator` | yes | non-empty string | Where in the source the value is: table and row, figure and bin, equation, section. |
| `source` | yes | `hepdata` \| `agent` \| `human` | Who extracted it: the HEPData ingestion script, an AI agent, or a person. |
| `status` | yes | `agent-draft` \| `cross-checked` \| `machine-verified` \| `human-verified` \| `disputed` | Verification status. See the README or the site glossary. |
| `date` | yes | date (`YYYY-MM-DD`) | Date of extraction; the verify workflow updates it when a value is verified. |
| `verified_by` | no | string | GitHub login of the person who verified it. Set by the verify workflow. |
| `issue` | no | `https://github.com/…` URL | The verify or flag issue. Set by the verify workflow. |
| `issues` | no | list of `https://github.com/…` URLs | Further flag issues on a datum that is already disputed. |

```yaml
provenance: {uid: 55bde34a, ref: "inspire:2022440", locator: "Sec. on results: σ_meas(pp → WWW) = 820 ± 100 (stat) ± 80 (syst) fb; total taken as the quadrature sum, 128/820 (no HEPData record)", source: agent, status: cross-checked, date: "2026-10-17"}
```

### `total`

The total relative uncertainty of a result or a prediction.

| Field | Required | Type | Meaning |
| --- | --- | --- | --- |
| `value_pct` | yes | number ≥ 0 | Total uncertainty in percent. |
| `provenance` | yes | provenance | |

### `size`

The size of one uncertainty source.

| Field | Required | Type | Meaning |
| --- | --- | --- | --- |
| `range` | yes | two numbers `[min, max]` | Smallest and largest value over the bins. For a single number, both are equal. |
| `asymmetric` | yes | boolean | Whether the source quotes different up and down values. |
| `unit` | no | non-empty string, default `%` | Relative percent unless another unit is given. |
| `regions` | no | list of `{where, value}` | Values in named kinematic regions. `where` is a non-empty string; `value` is `±N` or `+N/-N` (a Unicode minus is also accepted), for example `±40` or `+3.1/-5.0`. |

```yaml
size: {range: [5, 10], unit: "%", asymmetric: false, regions: [{where: "outer |y|max bins and high dijet mass", value: "±40"}]}
```

### Experimental uncertainty (`uncertainty_exp`)

| Field | Required | Type | Meaning |
| --- | --- | --- | --- |
| `category` | yes | `stat` \| `lumi` \| `energy_scale` \| `efficiency` \| `unfolding_model` \| `background` \| `acceptance_extrapolation` \| `beam` \| `pileup` \| `syst_combined` \| `other` | Fixed vocabulary. `syst_combined`: the source quotes only one combined systematic. `other` passes the schema but the build prints a warning. |
| `size` | yes | size | |
| `provenance` | yes | provenance | |
| `specific` | no | string | The name the source uses for this uncertainty. |
| `full_table` | no | ref | Where the full bin-by-bin values are, usually a HEPData table. |

```yaml
- category: stat
  specific: "Data statistics"
  size: {range: [12.2, 12.2], unit: "%", asymmetric: false}
  provenance: {uid: b6dedeae, ref: "inspire:2022440", locator: "Sec. on results: σ_meas ± 100 (stat) of 820 fb", source: agent, status: cross-checked, date: "2026-10-17"}
```

For data ingested from HEPData, the category is assigned from the error label by the regex table `data/hepdata_label_map.yaml` (first match wins, no match gives `other`).

### Theory uncertainty (`uncertainty_th`)

| Field | Required | Type | Meaning |
| --- | --- | --- | --- |
| `category` | yes | `MHOU` \| `PDF` \| `alphas` \| `parametric` \| `nonpert` \| `matching_shower` \| `EW_missing` \| `approximation` \| `numerical` | Fixed vocabulary. |
| `size` | yes | size | |
| `provenance` | yes | provenance | |
| `specific` | no | string | The name the source uses. |
| `method` | if `category` is `MHOU`, `nonpert` or `matching_shower` | non-empty string | How it was estimated, for example the scale-variation prescription. |
| `pdf_set` | if `category` is `PDF` | non-empty string | The PDF set. |
| `full_table` | no | ref | Where the full values are. |

```yaml
- category: MHOU
  specific: "μR and μF scale variation"
  method: "7-point scale variation around the dynamical scale of eq. (2)"
  size: {range: [5.1, 6.1], unit: "%", asymmetric: true}
  provenance: {uid: 4d8de0f6, ref: "inspire:2799239", locator: "Sec. 3.3, eq. (13): +6.1% −5.1%; 7-point prescription stated below Table 1", source: agent, status: cross-checked, date: "2026-10-22"}
```

### `accuracy`

The perturbative accuracy of a prediction.

| Field | Required | Type | Meaning |
| --- | --- | --- | --- |
| `qcd` | yes | `LO` \| `NLO` \| `NNLO` \| `N3LO` \| `N4LO` | QCD order, counted from the first non-vanishing order of the observable the prediction is for, not from the paper's naming. |
| `ew` | no | same values | Electroweak order. |
| `mixed` | no | string | Which mixed QCD×EW terms are included, in the paper's words. |
| `resummation` | no | list of `{accuracy, variable}`, both required strings | Logarithmic accuracy and the variable resummed, for example `{accuracy: "N3LL", variable: "pT(ℓℓ)"}`. |
| `shower_matched` | no | boolean | Matched to a parton shower. |
| `approximations` | no | list of strings | Approximations and caveats, from the paper. |

### `theory_target`

The theory precision a study says is needed for an observable.

| Field | Required | Type | Meaning |
| --- | --- | --- | --- |
| `required_total` | yes | string | The required total theory uncertainty, as the source states it. |
| `source` | yes | ref | The study. |
| `provenance` | yes | provenance | |
| `current_total` | no | string | The current total quoted by the same source. |

No file in `data/` uses `theory_target` yet, so there is no example to copy.

## `families.yaml`

A list. Each entry:

| Field | Required | Type | Meaning |
| --- | --- | --- | --- |
| `id` | yes | `fam:` id | |
| `name` | yes | non-empty string | Display name. |
| `sector` | yes | `SM` | The only value allowed today. |
| `order` | yes | integer | Sort order on the home page. |
| `maintainers` | no | list of strings | GitHub logins that get the flags (disputes) of this family assigned. |

```yaml
- {id: "fam:vector-bosons", name: "Vector bosons", sector: SM, order: 1, maintainers: []}
```

## `colliders.yaml`

A list. Each entry (all fields required):

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | `col:` id | |
| `name` | non-empty string | Display name, the column head in the family matrices. |
| `beams` | string | For example `pp`, `e+e−`. |
| `sqrts_gev` | number > 0, or `[min, max]` of two such numbers | Centre-of-mass energy in GeV, or a range. |
| `status` | `past` \| `running` \| `future` | |
| `order` | integer | Column order. |

```yaml
- {id: "col:lhc-13", name: "LHC 13 TeV", beams: "pp", sqrts_gev: 13000, status: running, order: 9}
- {id: "col:lep2", name: "LEP 2", beams: "e+e−", sqrts_gev: [130, 209], status: past, order: 2}
```

## Process files (`processes/<family>/<slug>.yaml`)

The folder name must match the family: a file in `processes/top/` must have `family: "fam:top"`.

### Process

| Field | Required | Type | Meaning |
| --- | --- | --- | --- |
| `id` | yes | `proc:` id | |
| `name` | yes | non-empty string | |
| `family` | yes | `fam:` id | The primary family. |
| `sector` | yes | `SM` | |
| `channels` | yes | list of channels | May be empty. |
| `also_in` | no | list of `fam:` ids | Other families whose matrix also shows this process. |
| `aliases` | no | list of `proc:` ids | Former ids. |
| `description` | no | string | One paragraph shown on the process page. |
| `watch` | no | object | Literature watch for `/refresh`, see below. |
| `building_blocks` | no | list of rows | See below. |

`watch`:

| Field | Required | Type | Meaning |
| --- | --- | --- | --- |
| `recids` | yes | list of integers | INSPIRE record numbers of key papers; new papers citing them become candidates. |
| `queries` | yes | list of strings | INSPIRE search strings. |
| `last_run` | no | date | Written by `scripts.candidates`; do not set it by hand. |

### `building_blocks`

A list of rows. Each row:

| Field | Required | Type | Meaning |
| --- | --- | --- | --- |
| `row` | yes | `NLO QCD` \| `NNLO QCD` \| `N3LO QCD` \| `NLO EW` \| `NNLO EW` \| `NNLO QCD×EW` | The perturbative order. |
| `cells` | yes | mapping | Keys from `born`, `1L`, `2L`, `3L`, `RV`, `RR`, `RRR`, `ir_scheme`, `code`. A key that is absent means "not recorded". |

Each cell:

| Field | Required | Type | Meaning |
| --- | --- | --- | --- |
| `status` | yes | `done` \| `partial` \| `missing` | |
| `provenance` | yes | provenance | |
| `approximations` | no | list of strings | Restrictions and approximations, from the paper. |
| `amplitude` | no | `amp:` id | The library entry for this loop amplitude. |
| `refs` | no | list of refs | |

### Channel

| Field | Required | Type | Meaning |
| --- | --- | --- | --- |
| `id` | yes | `chan:` id | |
| `collider` | yes | `col:` id | A process may have only one channel per collider. |
| `initial_state` | yes | non-empty string | For example `pp`. |
| `coverage` | yes | `complete` \| `partial` \| `stub` | How far the channel satisfies the coverage rule (`DECISIONS.md` #16). |
| `last_reviewed` | yes | date | The site marks the channel "may be outdated" 18 months after this date. |
| `aliases` | no | list of `chan:` ids | |
| `headline` | no | `{observable, region}`, both required | The observable (`obs:` id, which must belong to this channel) and the kinematic region (string) that represent the channel in the matrix. Without it the channel has no theory ÷ experiment ratio. |
| `measurements` | no | list of measurements | |
| `observables` | no | list of observables | |

### Measurement

| Field | Required | Type | Meaning |
| --- | --- | --- | --- |
| `id` | yes | `meas:` id | |
| `experiment` | yes | non-empty string | For example `ATLAS`; `combination` for a combination. |
| `dataset` | yes | string | Energy, luminosity, years. |
| `ref` | yes | ref | The paper. |
| `hepdata` | no | ref | The HEPData record or table. |
| `projected` | no | boolean | `true` for a projection for a future dataset. |
| `projection_source` | if `projected: true` | `{ref, date}`, both required | The study the projection comes from and its date. |
| `assumptions` | no | string | Assumptions of a projection. |
| `superseded_by` | no | `meas:` id | The measurement that replaces this one. |
| `preliminary` | no | boolean | `true` when there is no paper yet. |
| `aliases` | no | list of `meas:` ids | |

A measurement has no numbers of its own. Its numbers are the `results` under the observables.

### Observable

| Field | Required | Type | Meaning |
| --- | --- | --- | --- |
| `id` | yes | `obs:` id | |
| `name` | yes | non-empty string | |
| `kind` | yes | `total` \| `fiducial` \| `differential` \| `ratio` \| `asymmetry` \| `pseudo` | |
| `variable` | no | string | The precise definition: variable, cuts, binning. |
| `aliases` | no | list of `obs:` ids | |
| `results` | no | list of results | |
| `predictions` | no | list of predictions | |
| `resummation_ingredients` | no | list | See below. |
| `theory_target` | no | theory_target | |

### Result

One measurement's numbers for this observable.

| Field | Required | Type | Meaning |
| --- | --- | --- | --- |
| `measurement` | yes | `meas:` id | Must be a measurement of the same channel. |
| `total` | yes | total | |
| `uncertainties` | yes | list of experimental uncertainties | May be empty. |

### Prediction

| Field | Required | Type | Meaning |
| --- | --- | --- | --- |
| `label` | yes | non-empty string | Display name, for example `N3LO+N3LL QCD (NNLOJET+RadISH), ATLAS cuts`. |
| `accuracy` | yes | accuracy | |
| `refs` | yes | list of refs | May be empty. |
| `provenance` | yes | provenance | For the claim as a whole (that this calculation exists at this accuracy). |
| `codes` | no | list of strings | Programs used. |
| `uses_amplitudes` | no | list of `amp:` ids | Library amplitudes the calculation relies on. |
| `total` | no | total | Total theory uncertainty. Needed on the headline prediction for the channel to get a ratio. |
| `uncertainties` | no | list of theory uncertainties | |
| `compared_to` | no | list of `meas:` ids | Measurements whose paper compared to this prediction. |
| `headline` | no | boolean | At most one prediction per observable may have `headline: true`. |

### `resummation_ingredients`

Each entry (all fields required): `name` (non-empty string), `status` (non-empty free text, not the `done`/`partial`/`missing` vocabulary), `refs` (list of refs), `provenance`.

### Example

From `data/processes/vector-bosons/www.yaml`:

```yaml
id: "proc:www"
name: "WWW triboson production"
family: "fam:vector-bosons"
sector: SM
# … description
watch:
  recids: [1769246, 1598778]
  # … queries, last_run
building_blocks:
  - row: "NLO QCD"
    cells:
      # … 1L
      ir_scheme:
        status: done
        refs: ["inspire:782595"]
        provenance: {uid: '678e5694', ref: "inspire:782595", locator: "Abstract (real emission treated with dipole subtraction)", source: agent, status: cross-checked, date: "2026-10-17"}
      # … code
  # … NLO EW
channels:
  - id: "chan:www/lhc-13"
    collider: "col:lhc-13"
    initial_state: "pp"
    coverage: partial
    last_reviewed: "2026-10-22"
    headline: {observable: "obs:www/lhc-13/sigma-tot", region: "Inclusive pp → WWW at 13 TeV (on-shell WWW plus WH with H → WW*, all W decay modes)"}
    measurements:
      - id: "meas:www/lhc-13/atlas-2022-tot"
        experiment: "ATLAS"
        dataset: "13 TeV, 139 fb⁻¹ (2015–2018)"
        ref: "inspire:2022440"
      - id: "meas:www/lhc-13/cms-2020-tot"
        experiment: "CMS"
        dataset: "13 TeV, 137 fb⁻¹ (2016–2018)"
        ref: "inspire:1802096"
        hepdata: "hepdata:ins1802096/Table 1"
    observables:
      - id: "obs:www/lhc-13/sigma-tot"
        name: "Total σ(pp → WWW)"
        kind: total
        # … variable
        results:
          - measurement: "meas:www/lhc-13/atlas-2022-tot"
            total: {value_pct: 15.6, provenance: {uid: 55bde34a, ref: "inspire:2022440", locator: "Sec. on results: σ_meas(pp → WWW) = 820 ± 100 (stat) ± 80 (syst) fb; total taken as the quadrature sum, 128/820 (no HEPData record)", source: agent, status: cross-checked, date: "2026-10-17"}}
            uncertainties:
              - category: stat
                specific: "Data statistics"
                size: {range: [12.2, 12.2], unit: "%", asymmetric: false}
                provenance: {uid: b6dedeae, ref: "inspire:2022440", locator: "Sec. on results: σ_meas ± 100 (stat) of 820 fb", source: agent, status: cross-checked, date: "2026-10-17"}
              # … syst_combined
          # … CMS result
        predictions:
          - label: "NLO QCD: Sherpa 2.2.2 (WWW) + Powheg Box v2 (WH → WWW*), ATLAS setup"
            accuracy:
              qcd: NLO
              ew: LO
              shower_matched: true
              # … approximations
            codes: ["Sherpa", "Powheg Box", "Pythia8"]
            total: {value_pct: 3.5, provenance: {uid: defe90d1, ref: "inspire:2022440", locator: "Sec. on signal modelling: σ_pred(pp → WWW) = 511 ± 18 fb", source: agent, status: cross-checked, date: "2026-10-17"}}
            compared_to: ["meas:www/lhc-13/atlas-2022-tot"]
            refs: ["inspire:2022440", "inspire:1598778"]
            provenance: {uid: e4faba94, ref: "inspire:2022440", locator: "Abstract and Sec. on signal modelling (Sherpa 2.2.2 WWW, Powheg Box v2 + Pythia 8.235 WH)", source: agent, status: cross-checked, date: "2026-10-17"}
            headline: true
          # … further predictions
```

A projected measurement, from `data/processes/dis/dis-cc.yaml`:

```yaml
- id: "meas:dis-cc/eic/yr-proj"
  experiment: "EIC"
  dataset: "EIC Yellow Report projection: unpolarised CC e±p pseudo-data (DJANGOH), 10 fb⁻¹, optimistic systematics scenario"
  ref: "arXiv:2103.05419"
  projected: true
  projection_source: {ref: "arXiv:2103.05419", date: "2021-03-08"}
  # … assumptions
```

## Amplitude files (`amplitudes/<slug>.yaml`)

One loop amplitude, stored once and referenced from building-block cells (`amplitude`) and predictions (`uses_amplitudes`).

| Field | Required | Type | Meaning |
| --- | --- | --- | --- |
| `id` | yes | `amp:` id | By convention `amp:<loops>L/<partonic process>`. |
| `process` | yes | `proc:` id | The process the entry is filed under; other processes use it through their building-block cells and predictions. |
| `loops` | yes | integer ≥ 0 | |
| `corrections` | yes | `QCD` \| `EW` \| `mixed` | |
| `status` | yes | `done` \| `partial` \| `missing` | |
| `refs` | yes | list of refs | |
| `provenance` | yes | provenance | |
| `approximations` | no | list of strings | |
| `master_integrals` | no | `{status, refs}`, both required | `status` is `done` \| `partial` \| `missing`. |
| `evaluation` | no | object | How the amplitude is evaluated, see below. |
| `aliases` | no | list of `amp:` ids | |

`evaluation`:

| Field | Required | Type | Meaning |
| --- | --- | --- | --- |
| `kind` | yes | `analytic` \| `semi-analytic` \| `numerical` | Closed form; reduced to masters with some evaluated by series expansion or numerically; grid or fully numerical. |
| `provenance` | yes | provenance | |
| `detail` | no | string, 1 to 160 characters | One line naming the function class or the method. |

`data/amplitudes/2L-qqbar-V.yaml`, in full:

```yaml
id: "amp:2L/qqbar-V"
process: "proc:dy-nc"
loops: 2
corrections: QCD
status: done
master_integrals:
  status: done
  refs: ["inspire:686721"]
evaluation:
  kind: analytic
  detail: "master integrals in closed form, all orders in ε"
  provenance: {uid: 8f2947a0, ref: "inspire:686721", locator: "Abstract (two-loop form factors to all orders in ε)", source: agent, status: cross-checked, date: "2026-10-16"}
refs: ["inspire:24603", "inspire:686721"]
provenance: {uid: c9ece9f4, ref: "inspire:686721", locator: "Abstract (two-loop massless quark form factor γ*→qq̄ to all orders in ε; master integrals in closed form)", source: agent, status: cross-checked, date: "2026-10-16"}
```

## Parameter files (`parameters/<slug>.yaml`)

| Field | Required | Type | Meaning |
| --- | --- | --- | --- |
| `id` | yes | `par:` id | |
| `name` | yes | non-empty string | |
| `symbol` | yes | non-empty string | |
| `unit` | yes | string | Empty for a dimensionless parameter. |
| `determinations` | yes | list | See below. |
| `aliases` | no | list of `par:` ids | |

Each determination (all fields required):

| Field | Type | Meaning |
| --- | --- | --- |
| `value` | number | In the parameter's `unit`. |
| `uncertainty` | number | Absolute, in the same unit. |
| `extracted_from` | list of `obs:` or `meas:` ids | The observables or measurements the value was extracted from; may be empty. |
| `ref` | ref | |
| `provenance` | provenance | |

From `data/parameters/m-w.yaml`:

```yaml
id: "par:m-w"
name: "W boson mass"
symbol: "m_W"
unit: "GeV"
determinations:
  - value: 80.3625
    uncertainty: 0.0077
    extracted_from: []
    ref: "inspire:3193100"
    provenance: {uid: 18b19456, ref: "inspire:3193100", locator: "PDG 2026 edition, W MASS (PDG API summary S043M, OUR EVALUATION, LHC-Tevatron M_W Working Group): 80.3625 ± 0.0077 GeV", source: agent, status: cross-checked, date: "2026-10-17"}
  # … four more determinations
```

## Rules beyond the schema

`scripts/opensigma/validate.py` checks these after the schemas pass:

- Ids and aliases are unique across all files, and so are provenance uids.
- Every id used as a reference exists and is an id, not an alias. This covers `family`, `also_in`, `collider`, `measurement`, `superseded_by`, `compared_to`, `amplitude`, `uses_amplitudes`, `process`, `extracted_from` and `headline.observable`.
- A process has at most one channel per collider.
- A channel's headline observable is one of its own observables.
- A result's measurement belongs to the same channel as its observable.
- An observable has at most one prediction with `headline: true`.
- A process file's folder matches its `family`.
- Uncertainty category `other` gives a warning, not an error.

The build also fails if a reference cannot be resolved (offline: if it is not in `data/refs.json`).

## Files written by tools

| File | Written by | Content |
| --- | --- | --- |
| `data/refs.json` | `scripts.refs`, `scripts.build` | Per reference: `recid`, `arxiv`, `doi`, `title`, `authors_short`, `year`, `bibtex`. Committed. |
| `data/candidates.json` | `scripts.candidates` (through `/refresh`), then triaged by `/draft-process` | `{proc_id: [{recid, title, arxiv, matched_by, channels?}]}`. `channels` absent: not triaged; a list of `chan:` ids: counted there as "not yet incorporated"; `[]`: does not belong anywhere. |
| `data/hepdata_label_map.yaml` | by hand | Regex → experimental uncertainty category, used by `scripts.ingest_hepdata` and `scripts.machine_verify`. |
| `data/release.yaml` | by hand at release time (`RELEASING.md`) | `{version, doi, concept_doi}`. Absent until the first release. |
| `site/data.json` | `scripts.build` | Everything above merged, plus `build` and `derived`. Not committed. |

## What is never stored

These follow from the data and are computed by `scripts/opensigma/derive.py` into the `derived` part of `site/data.json`:

- per channel: the highest QCD order of any prediction, the theory ÷ experiment ratio on the headline observable (with and without projections), the number of measurements and of candidate papers, the lowest verification status of any datum, whether a theory target exists, and whether the channel is stale;
- per observable: the best experimental total (superseded and preliminary measurements are skipped) and the total of the headline prediction;
- per family: counts and the fraction of channels with a prediction at NNLO or beyond;
- reverse links from amplitudes to the cells and predictions that use them, the parent of every id, the alias table and the search index.
