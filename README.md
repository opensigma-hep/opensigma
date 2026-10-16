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

## CI & deployment

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main`: `pytest`, `npm test` (Node 22), `python -m scripts.build --check --offline`, and, only when `data/**` changed, `scripts.machine_verify` (report-only) and `scripts.linkcheck`. `.github/workflows/pages.yml` runs on pushes to `main` (and manually): it builds `site/data.json` with `--offline` and deploys `site/` to GitHub Pages at `https://pheno-map.github.io/pheno-map/`. The repo owner must first complete the Task 0 settings (create the `pheno-map` org/repo, set Pages source to "GitHub Actions"); neither workflow has been run live yet.
