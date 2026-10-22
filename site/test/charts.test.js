import test from 'node:test';
import assert from 'node:assert/strict';
import { historyPoints, runningMin } from '../js/charts.js';

const refs = { 'inspire:1': { year: 2016 }, 'inspire:2': { year: 2022 }, 'arXiv:3': { year: 2019 } };
const meas = {
  'meas:a': { id: 'meas:a', experiment: 'ATLAS', dataset: '13 TeV', ref: 'inspire:1' },
  'meas:p': { id: 'meas:p', experiment: 'ATLAS', dataset: 'HL', ref: 'inspire:2', projected: true },
};
const obs = {
  results: [{ measurement: 'meas:a', total: { value_pct: 2 } }, { measurement: 'meas:p', total: { value_pct: 0.5 } },
    { measurement: 'meas:gone', total: { value_pct: 1 } }],
  predictions: [
    { label: 'NNLO', accuracy: { qcd: 'NNLO' }, refs: ['arXiv:3'], total: { value_pct: 3, provenance: { ref: 'inspire:2, Table 1' } } },
    { label: 'no total', accuracy: { qcd: 'NLO' }, refs: ['inspire:1'] },
  ],
};

test('historyPoints: one point per dated total, year from the total’s own source', () => {
  const pts = historyPoints(obs, meas, refs);
  assert.deepEqual(pts.map((p) => [p.kind, p.key, p.year, p.pct, !!p.projected]),
    [['meas', 'meas:a', 2016, 2, false], ['meas', 'meas:p', 2022, 0.5, true], ['pred', '0', 2022, 3, false]]);
});

test('runningMin: record steps only, projections excluded', () => {
  const pts = [{ year: 2020, pct: 3 }, { year: 2010, pct: 5 }, { year: 2015, pct: 6 }, { year: 2024, pct: 1, projected: true }];
  assert.deepEqual(runningMin(pts), [{ year: 2010, pct: 5 }, { year: 2020, pct: 3 }]);
});
