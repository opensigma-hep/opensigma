import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRegionValue, accuracyChips, statusBadge, fmtSize } from '../js/format.js';

test('±', () => assert.deepEqual(parseRegionValue('±0.4'), { up: 0.4, down: -0.4 }));
test('unicode minus', () => assert.deepEqual(parseRegionValue('+3.1/−5.0'), { up: 3.1, down: -5.0 }));
test('ascii minus', () => assert.deepEqual(parseRegionValue('+3.1/-5.0'), { up: 3.1, down: -5.0 }));
test('garbage throws', () => {
  for (const s of ['about 3%', '3.1', '+3.1/5.0', '±', '', undefined]) assert.throws(() => parseRegionValue(s));
});

test('chips', () => assert.deepEqual(
  accuracyChips({ qcd: 'NNLO', ew: 'NLO', resummation: [{ accuracy: "N3LL'", variable: 'qT' }], shower_matched: true }),
  ['NNLO QCD', 'NLO EW', 'N3LL′ qT', '+PS']));
test('chips: mixed and approximations', () => assert.deepEqual(
  accuracyChips({ qcd: 'NLO', mixed: 'NNLO QCD×EW', approximations: ['m_t→∞'] }),
  ['NLO QCD', 'NNLO QCD×EW', 'm_t→∞']));

test('status badges', () => {
  for (const s of ['agent-draft', 'cross-checked', 'machine-verified', 'human-verified', 'disputed']) {
    assert.deepEqual(statusBadge(s), { label: s, cls: 'badge st-' + s });
  }
  assert.equal(statusBadge(undefined).cls, 'badge st-unknown');
});

test('fmtSize', () => {
  assert.equal(fmtSize({ range: [0.4, 6], asymmetric: false }), '0.4–6.0 %');
  assert.equal(fmtSize({ range: [0.01, 0.01], asymmetric: false }), '0.01 %');
  assert.equal(fmtSize({ range: [5, 12.5], unit: 'MeV', asymmetric: true }), '5.0–12.5 MeV');
});
