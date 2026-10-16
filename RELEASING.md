# Releasing

Releases are cut manually by the owner. Data is CC BY 4.0 (`data/LICENSE`), code is MIT (`LICENSE`); Zenodo archives both under the metadata in `.zenodo.json`.

1. `python -m scripts.contributors` (regenerates `.zenodo.json` from `CITATION.cff`, `verified_by` and family `maintainers`)
2. Commit the result.
3. `gh release create vYYYY.MM --generate-notes`
4. Zenodo mints the DOI (version DOI plus the concept DOI that covers all versions).
5. Paste both into `data/release.yaml` as `{version, doi, concept_doi}` and commit. The build copies it into `data.json` as `build.release`, which switches the footer from "unreleased" to "Cite this version".
