import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseBibtex } from '../js/bibtex.js';

const rel = { version: 'v2026.10', doi: '10.5281/zenodo.2', concept_doi: '10.5281/zenodo.1' };

test('version and concept entries', () => {
  const b = releaseBibtex(rel, 2026);
  assert.match(b, /@misc\{pheno-map-v2026\.10,[^@]*version = \{v2026\.10\},[^@]*doi = \{10\.5281\/zenodo\.2\}/);
  assert.match(b, /@misc\{pheno-map-concept,[^@]*doi = \{10\.5281\/zenodo\.1\}/);
  assert.match(b, /year = \{2026\}/);
});

test('no release, no bibtex', () => assert.equal(releaseBibtex(null, 2026), ''));
