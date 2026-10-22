import test from 'node:test';
import assert from 'node:assert/strict';
import { gaps, nextRun, orderTimeline } from '../js/insights.js';

const pred = (qcd, refs, total) => ({ label: qcd, accuracy: { qcd }, refs, ...(total ? { total: { value_pct: total } } : {}) });
const data = {
  refs: { 'inspire:1': { year: 2000 }, 'inspire:2': { year: 2010 }, 'inspire:3': { year: 2020 } },
  processes: [
    { id: 'proc:a', building_blocks: [{ row: 'NNLO QCD', cells: { '2L': { status: 'done' }, RR: { status: 'partial', approximations: ['lc'] } } }],
      channels: [{ id: 'chan:a/x', measurements: [{ id: 'meas:p', projected: true }, { id: 'meas:q', projected: true }, { id: 'meas:n' }],
        observables: [{ id: 'obs:a/x/s', results: [{ measurement: 'meas:p', total: { value_pct: 2 } }, { measurement: 'meas:q', total: { value_pct: 1 } },
          { measurement: 'meas:n', total: { value_pct: 0.1 } }],
        predictions: [pred('NLO', ['inspire:1']), pred('NNLO', ['inspire:3', 'inspire:2'], 3)] }] }] },
    { id: 'proc:b', building_blocks: [{ row: 'NLO EW', cells: { '1L': { status: 'missing' }, RV: { status: 'partial' } } }],
      channels: [{ id: 'chan:b/x', measurements: [{ id: 'meas:b', projected: true }],
        observables: [{ id: 'obs:b/x/s', results: [{ measurement: 'meas:b', total: { value_pct: 5 } }], predictions: [pred('N3LO', ['inspire:3'])] }] }] },
    { id: 'proc:c', building_blocks: [{ row: 'NLO QCD', cells: { '1L': { status: 'done' } } }], channels: [] },
  ],
  derived: {
    cells: { 'chan:a/x': { process: 'proc:a', ratio: 3 }, 'chan:b/x': { process: 'proc:b', ratio: null } },
    observable_summary: { 'obs:a/x/s': { th_pct: 3 }, 'obs:b/x/s': { th_pct: null } },
  },
};

test('gaps: only open cells, worst ratio first, all-done processes dropped', () => {
  const g = gaps(data);
  assert.deepEqual(g.map((x) => [x.proc.id, x.worst?.ratio ?? null, x.open.map((o) => `${o.row}/${o.col}/${o.status}`)]),
    [['proc:a', 3, ['NNLO QCD/RR/partial']], ['proc:b', null, ['NLO EW/1L/missing', 'NLO EW/RV/partial']]]);
});

test('nextRun: best projection vs theory on the same observable; no theory listed last', () => {
  const r = nextRun(data);
  assert.deepEqual(r.map((x) => [x.obs.id, x.proj, x.th, x.ratio]), [['obs:a/x/s', 1, 3, 3], ['obs:b/x/s', 5, null, null]]);
  assert.equal(r[0].measurement.id, 'meas:q');
});

test('orderTimeline: channels reaching each order by year, from the earliest cited year', () => {
  const t = orderTimeline(data, 2021);
  assert.equal(t.years[0], 2000);
  const at = (lv, y) => t.series[lv][t.years.indexOf(y)];
  assert.deepEqual([at('NLO', 2000), at('NLO', 2020), at('NNLO', 2009), at('NNLO', 2010), at('N3LO', 2020)], [1, 2, 0, 1, 1]);
  assert.deepEqual(t.milestones.map((m) => `${m.proc.id} ${m.level} ${m.year}`),
    ['proc:a NLO 2000', 'proc:a NNLO 2010', 'proc:b NLO 2020', 'proc:b NNLO 2020', 'proc:b N3LO 2020']);
});
