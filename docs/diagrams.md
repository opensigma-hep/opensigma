# Leading-order Feynman diagrams

`data/diagrams.yaml` holds one representative leading-order diagram per process, keyed by process id.
The site draws it on the process page, as a thumbnail in the family matrix, and on the process atlas (`#/processes`).
A process without an entry shows no diagram; nothing else breaks.

## Format

```yaml
proc:dy-nc:
  title: "q q̄ → Z/γ* → ℓ⁺ℓ⁻"        # caption and accessible title ("Leading-order diagram: …")
  note: "optional second caption line"  # e.g. which other diagrams are not shown
  points: {i1: [0, 0.5], i2: [0, 2.5], a: [1.2, 1.5], b: [2.8, 1.5], o1: [4, 0.5], o2: [4, 2.5]}
  edges:
    - {from: i1, to: a, type: fermion, label: "q"}
    - {from: i2, to: a, type: antifermion, label: "q̄"}
    - {from: a, to: b, type: boson, label: "Z/γ*"}
    - {from: b, to: o1, type: fermion, label: "ℓ⁻"}
    - {from: b, to: o2, type: antifermion, label: "ℓ⁺"}
```

- **Grid.** `points` are named `[x, y]` positions with x from 0 to 4 and y from 0 to 3 (decimals allowed). Time runs
  left to right; y grows downwards. The canvas is the same for every diagram, so centre yours around `[2, 1.5]`.
- **Vertices and legs.** A point touched by two or more edges is a vertex and gets a dot. A point touched by one edge
  is the free end of an external leg.
- **Edges.** Write them in time order (`from` on the left). `type` is one of

  | type | drawn as | use for |
  |---|---|---|
  | `fermion` | straight line, arrow `from` → `to` | quarks, leptons |
  | `antifermion` | straight line, arrow `to` → `from` | antiquarks, antileptons |
  | `gluon` | coil | gluons |
  | `photon`, `boson` | wavy line | γ; W, Z |
  | `scalar` | dashed line | Higgs |
  | `ghost` | dotted line with arrow | ghosts |

  Fermion arrows must form continuous lines: at each vertex as many arrows enter as leave (a test checks this).
  For a loop (gg → H), write the loop edges head to tail: `a → c`, `c → b`, `b → a`.
- **Labels.** `label` is optional plain text; use Unicode for bars and charges (`q̄` = q + U+0304, `W⁺`, `ℓ⁻`, `γ*`, `νₑ`).
  The label of an external leg goes beyond its free end. The label of a propagator goes beside its midpoint: above
  the line, or to the right of a vertical line. Add `flip: true` to put it on the other side.

Two standard layouts cover most 2 → 2 processes:

```yaml
# s-channel
points: {i1: [0, 0.5], i2: [0, 2.5], a: [1.2, 1.5], b: [2.8, 1.5], o1: [4, 0.5], o2: [4, 2.5]}
# t-channel (exchange a–b is vertical)
points: {i1: [0, 0.5], i2: [0, 2.5], a: [2, 0.75], b: [2, 2.25], o1: [4, 0.5], o2: [4, 2.5]}
```

## Checks

`python -m scripts.build --check --offline` validates the file against `data/schema/diagrams.schema.json` and checks
that every key is an existing process id and every edge joins two declared points.

## Renderer

`site/js/feynman.js` exports `feynmanSvg(spec, opts)`, a pure function returning SVG markup. `opts.thumb` gives the
label-free thumbnail variant. Lines use `currentColor`, so the diagram follows the light or dark theme.
