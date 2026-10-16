import test from 'node:test';
import assert from 'node:assert/strict';
import { columnsFor, cellState, passes } from '../js/matrix.js';
import { scatterPoints } from '../js/scatter.js';

const cell = (o = {}) => ({
  process: 'proc:a', collider: 'col:x', max_qcd: 'NNLO', ratio: 2, ratio_with_projections: 0.5,
  coverage: 'complete', stale: false, candidates: 0, n_measurements: 3, min_status: 'cross-checked',
  has_target: false, ...o,
});

test('null ratio hatched', () => {
  const s = cellState(cell({ ratio: null }), 'ratio', false);
  assert.equal(s.pattern, 'hatch');
  assert.equal(cellState(cell({ ratio: null, ratio_with_projections: 1 }), 'ratio', true).pattern, 'none');
  assert.equal(cellState(cell({ ratio: null }), 'order', false).pattern, 'none');
});

test('stub with no QCD order hatched in order mode too', () => {
  assert.equal(cellState(cell({ max_qcd: null, ratio: null, coverage: 'stub' }), 'order', false).pattern, 'hatch');
});

test('partial coverage texture', () => {
  const s = cellState(cell({ coverage: 'partial' }), 'order', false);
  assert.equal(s.pattern, 'partial');
  assert.notEqual(s.pattern, 'hatch');
});

test('missing cell', () => {
  const s = cellState(undefined, 'order', false);
  assert.equal(s.label, 'no channel');
  assert.equal(s.pattern, 'none');
});

test('labels and fills', () => {
  assert.equal(cellState(cell(), 'order', false).label, 'NNLO QCD, 3 measurements');
  assert.equal(cellState(cell({ n_measurements: 1 }), 'order', false).label, 'NNLO QCD, 1 measurement');
  assert.match(cellState(cell(), 'order', false).fill, /--ord-3/);
  assert.match(cellState(cell({ ratio: 0.3 }), 'ratio', false).fill, /--rat-1/);
  assert.match(cellState(cell({ ratio: 1 }), 'ratio', false).fill, /--rat-3/);
  assert.match(cellState(cell({ ratio: 5 }), 'ratio', false).fill, /--rat-5/);
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
