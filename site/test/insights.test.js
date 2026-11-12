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

const cell = (status, ...refs) => ({ status, refs });
const tdata = {
  refs: { 'inspire:1': { year: 1988 }, 'inspire:2': { year: 1990 }, 'inspire:3': { year: 2006 }, 'inspire:4': { year: 2009 }, 'inspire:5': { year: 2021 } },
  processes: [
    { id: 'proc:a', building_blocks: [
      { row: 'NLO QCD', cells: { '1L': cell('done', 'inspire:1, Sec. 2') } },                       // no code cell, all done
      { row: 'NNLO QCD', cells: { '2L': cell('done', 'inspire:1'), RR: cell('partial', 'inspire:2'), code: cell('done', 'inspire:4', 'inspire:3') } },
      { row: 'N3LO QCD', cells: { '3L': cell('done', 'inspire:4'), code: cell('partial', 'inspire:5') } }, // code not done
      { row: 'NLO EW', cells: { code: cell('done', 'inspire:1') } },                                 // not a QCD row
    ] },
    { id: 'proc:b', building_blocks: [
      { row: 'NNLO QCD', cells: { code: cell('done', 'inspire:5') } },                               // no NLO row
      { row: 'N3LO QCD', cells: { '3L': cell('done', 'inspire:4'), RV: cell('done', 'inspire:5') } }, // amplitudes only, no code
    ] },
    { id: 'proc:c', building_blocks: [{ row: 'NLO QCD', cells: { '1L': cell('done', 'inspire:1'), RV: cell('partial', 'inspire:2') } }] },
    { id: 'proc:d' },
  ],
};

test('orderTimeline: milestones come from the building-block row of that order only', () => {
  const t = orderTimeline(tdata, 2022);
  assert.deepEqual(t.milestones.map((m) => `${m.proc.id} ${m.level} ${m.year} ${m.ref}`),
    ['proc:a NLO 1988 inspire:1, Sec. 2', 'proc:a NNLO 2006 inspire:3', 'proc:b NNLO 2021 inspire:5']);
});

test('orderTimeline: processes at or above each order per year, consistent with the milestones', () => {
  const t = orderTimeline(tdata, 2022);
  assert.equal(t.total, 4);
  assert.deepEqual([t.years[0], t.years.at(-1)], [1988, 2022]);
  const at = (lv, y) => t.series[lv][t.years.indexOf(y)];
  // proc:b has no NLO row: it counts as >= NLO from its NNLO year, without an NLO milestone
  assert.deepEqual([at('NLO', 1988), at('NLO', 2020), at('NLO', 2021), at('NNLO', 2005), at('NNLO', 2006), at('NNLO', 2021), at('N3LO', 2022)],
    [1, 1, 2, 0, 1, 2, 0]);
});

test('orderTimeline: nothing dated gives an empty timeline', () => {
  assert.deepEqual(orderTimeline({ refs: {}, processes: [{ id: 'proc:x' }] }, 2022), { years: [], series: {}, milestones: [], total: 1 });
});
