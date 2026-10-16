# pheno-map

A map of collider-physics processes. Data lives as YAML under `data/` (`data/families.yaml`, `data/colliders.yaml`, `data/processes/`, `data/amplitudes/`, `data/parameters/`),
a Python build (`scripts/`) turns it into `site/data.json`, and a static JS site renders it.

## Setup

```bash
python3 -m venv .venv
.venv/bin/pip install -e '.[dev]'
.venv/bin/pytest
```

Code is MIT (`LICENSE`); data is CC BY 4.0 (`data/LICENSE`).
