import test from 'node:test';
import assert from 'node:assert/strict';
import { collectBibtex } from '../js/bibtex.js';

const refs = {
  'inspire:1': { bibtex: '@a{1}\n' },
  'arXiv:2001.00001': { bibtex: '@a{1}\n' },
  'inspire:2': { bibtex: '@a{2}\n' },
};

test('unique refs in first-seen order, aliases and hepdata collapse onto the record', () => {
  const node = {
    refs: ['inspire:2'],
    results: [{ provenance: { ref: 'arXiv:2001.00001', source: 'agent' }, full_table: 'hepdata:ins1/Table 2' }],
    more: { ref: 'inspire:1', other: 'inspire:999' },
  };
  assert.equal(collectBibtex(node, refs), '@a{2}\n\n@a{1}\n');
});

test('nothing to cite', () => assert.equal(collectBibtex({ name: 'x' }, refs), ''));
