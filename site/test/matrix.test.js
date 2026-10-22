import test from 'node:test';
import assert from 'node:assert/strict';
import { columnsFor, cellState, passes } from '../js/matrix.js';
import { scatterPoints } from '../js/scatter.js';

const cell = (o = {}) => ({
  process: 'proc:a', collider: 'col:x', max_qcd: 'NNLO', ratio: 2, ratio_with_projections: 0.5,
  coverage: 'complete', stale: false, candidates: 0, n_measurements: 3, min_status: 'cross-checked',
  has_target: false, ...o,
});

test('null ratio hatched, unless projections supply one', () => {
  assert.equal(cellState(cell({ ratio: null }), false).pattern, 'hatch');
  assert.equal(cellState(cell({ ratio: null, ratio_with_projections: 1 }), true).pattern, 'none');
});

test('partial coverage texture', () => {
  assert.equal(cellState(cell({ coverage: 'partial' }), false).pattern, 'partial');
});

test('missing cell', () => {
  const s = cellState(undefined, false);
  assert.equal(s.label, 'no channel');
  assert.equal(s.pattern, 'none');
});

test('labels carry the QCD order; fills follow the ratio', () => {
  assert.equal(cellState(cell(), false).label, 'NNLO QCD, precision ratio 2 (theory/experiment), 3 measurements');
  assert.equal(cellState(cell({ n_measurements: 1, max_qcd: null, ratio: null }), false).label, 'no QCD prediction, no precision ratio, 1 measurement');
  assert.match(cellState(cell({ ratio: 0.3 }), false).fill, /--rat-1/);
  assert.match(cellState(cell({ ratio: 1 }), false).fill, /--rat-3/);
  assert.match(cellState(cell({ ratio: 5 }), false).fill, /--rat-5/);
  assert.match(cellState(cell(), false).fill, /--rat-4/); // ratio 2
  assert.match(cellState(cell(), true).fill, /--rat-1/); // ratio_with_projections 0.5
});

test('columns only used colliders, ordered', () => {
  const colliders = [{ id: 'c3', order: 9 }, { id: 'c1', order: 5 }, { id: 'c2', order: 7 }];
  const cells = {
    'chan:1': { process: 'proc:a', collider: 'c3' }, 'chan:2': { process: 'proc:a', collider: 'c1' },
    'chan:3': { process: 'proc:other', collider: 'c2' },
  };
  assert.deepEqual(columnsFor(['proc:a'], cells, colliders).map((c) => c.id), ['c1', 'c3']);
  assert.deepEqual(columnsFor([], cells, colliders), []);
});

test('filters', () => {
  const any = { minOrder: 'any', minStatus: 'any', hasTarget: false };
  assert.ok(passes(cell({ max_qcd: null, min_status: null }), any));
  assert.ok(!passes(cell({ max_qcd: null }), { ...any, minOrder: 'LO' }));
  assert.ok(!passes(cell({ max_qcd: 'NLO' }), { ...any, minOrder: 'NNLO' }));
  assert.ok(passes(cell({ max_qcd: 'N3LO' }), { ...any, minOrder: 'NNLO' }));
  assert.ok(!passes(cell({ min_status: null }), { ...any, minStatus: 'disputed' }));
  assert.ok(!passes(cell({ min_status: 'agent-draft' }), { ...any, minStatus: 'cross-checked' }));
  assert.ok(passes(cell({ min_status: 'human-verified' }), { ...any, minStatus: 'cross-checked' }));
  assert.ok(!passes(cell(), { ...any, hasTarget: true }));
  assert.ok(passes(cell({ has_target: true }), { ...any, hasTarget: true }));
});

test('scatter points skip missing values and follow the projections toggle', () => {
  const s = {
    a: { exp_pct: 1, exp_pct_with_projections: 0.5, th_pct: 2 },
    b: { exp_pct: null, exp_pct_with_projections: 0.4, th_pct: 3 },
    c: { exp_pct: 1, exp_pct_with_projections: 1, th_pct: null },
  };
  assert.deepEqual(scatterPoints(s, false), [{ id: 'a', x: 1, y: 2 }]);
  assert.deepEqual(scatterPoints(s, true), [{ id: 'a', x: 0.5, y: 2 }, { id: 'b', x: 0.4, y: 3 }]);
});
