import test from 'node:test';
import assert from 'node:assert/strict';
import { expByName, measurementCounts, measurementsBy, experimentsAt } from '../js/experiments.js';
import { parseHash } from '../js/router.js';
import { search } from '../js/search.js';

const data = {
  families: [{ id: 'fam:b', order: 2 }, { id: 'fam:a', order: 1 }, { id: 'fam:empty', order: 3 }],
  experiments: [
    { id: 'exp:atlas', name: 'ATLAS', kind: 'experiment', colliders: ['col:x', 'col:y'] },
    { id: 'exp:eic', name: 'EIC', kind: 'facility', colliders: ['col:y'] },
    { id: 'exp:combination', name: 'combination', kind: 'combination' },
  ],
  processes: [
    { id: 'proc:p', family: 'fam:b', channels: [{ id: 'chan:p/x',
      measurements: [{ id: 'meas:1', experiment: 'ATLAS' }, { id: 'meas:2', experiment: 'CMS' }, { id: 'meas:3', experiment: 'ATLAS' }],
      observables: [{ id: 'obs:s', results: [{ measurement: 'meas:1' }, { measurement: 'meas:2' }] }, { id: 'obs:d', results: [{ measurement: 'meas:1' }] }, { id: 'obs:none' }] }] },
    { id: 'proc:q', family: 'fam:a', channels: [{ id: 'chan:q/x', measurements: [{ id: 'meas:4', experiment: 'ATLAS' }] }, { id: 'chan:q/y' }] },
  ],
};

test('expByName: lookup by the name measurements use; no registry = empty', () => {
  assert.equal(expByName(data.experiments).get('ATLAS').id, 'exp:atlas');
  assert.equal(expByName(data.experiments).get('CMS'), undefined);
  assert.equal(expByName(undefined).size, 0);
});

test('measurementCounts: per experiment name, registered or not', () => {
  assert.deepEqual(measurementCounts(data), { ATLAS: 3, CMS: 1 });
});

test('measurementsBy: grouped by family in display order, with the observables citing each measurement', () => {
  const g = measurementsBy(data, 'ATLAS');
  assert.deepEqual(g.map((x) => [x.family.id, x.rows.map((r) => `${r.chan.id} ${r.m.id} ${r.observables.map((o) => o.id)}`)]),
    [['fam:a', ['chan:q/x meas:4 ']], ['fam:b', ['chan:p/x meas:1 obs:s,obs:d', 'chan:p/x meas:3 ']]]);
  assert.deepEqual(measurementsBy(data, 'nobody'), []);
});

test('experimentsAt: experiments and facilities at a collider, never the combination pseudo-experiment', () => {
  assert.deepEqual(experimentsAt(data.experiments, 'col:y').map((e) => e.name), ['ATLAS', 'EIC']);
  assert.deepEqual(experimentsAt(data.experiments, 'col:z'), []);
  assert.deepEqual(experimentsAt(undefined, 'col:y'), []);
});

test('routing: exp: ids open the experiment view, #/experiments the index', () => {
  assert.deepEqual(parseHash('#/exp:atlas', {}, new Set(['exp:atlas'])), { view: 'experiment', id: 'exp:atlas' });
  assert.equal(parseHash('#/exp:ghost', {}, new Set()).view, 'notfound');
  assert.equal(parseHash('#/experiments', {}, new Set()).view, 'experiments');
});

test('search: the experiment itself ranks before its measurements on equal match', () => {
  const idx = [{ id: 'exp:atlas', kind: 'exp', label: 'ATLAS', text: 'ATLAS' }, { id: 'meas:1', kind: 'meas', label: 'ATLAS 139 fb', text: '' }];
  assert.deepEqual(search(idx, 'atlas').map((h) => h.id), ['exp:atlas', 'meas:1']);
});
