import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GLOSSARY, lookup, define, scan, glossaryHash } from '../js/glossary.js';
import { BB_COLS, BB_HEAD } from '../js/leaf.js';
import { ORDERS, LADDER } from '../js/matrix.js';
import { accuracyChips } from '../js/format.js';
import { parseHash } from '../js/router.js';

const schema = (name) => JSON.parse(readFileSync(new URL(`../../data/schema/${name}.schema.json`, import.meta.url), 'utf8'));
const common = schema('common').$defs, proc = schema('process').properties, amp = schema('amplitude').properties;
const chan = proc.channels.items.properties;
const has = (label, scope) => {
  const e = lookup(label, scope);
  assert.ok(e, `no glossary entry for ${JSON.stringify(label)}${scope ? ` (${scope})` : ''}`);
  if (scope) assert.equal(e.scope, scope, `${label}: expected the ${scope} entry, got ${e.id}`);
  return e;
};

test('entries are well formed and reachable by id', () => {
  const ids = new Set();
  for (const e of GLOSSARY) {
    for (const k of ['term', 'short', 'long', 'group', 'id']) assert.ok(typeof e[k] === 'string' && e[k], `${e.term}: ${k}`);
    assert.ok(!ids.has(e.id), `duplicate id ${e.id}`);
    ids.add(e.id);
    assert.equal(lookup(e.id), e, `id ${e.id} resolves to another entry`);
    assert.ok(e.short.length <= 200, `${e.term}: short definition is a tooltip, keep it under 200 characters`);
    assert.equal(parseHash(glossaryHash(e.id), {}, new Set()).t, e.id);
  }
});

test('building-block columns, rows and statuses are defined', () => {
  for (const c of BB_COLS) { has(c); has(BB_HEAD[c] ?? c); }
  assert.deepEqual(proc.building_blocks.items.properties.cells.propertyNames.enum, BB_COLS);
  for (const row of proc.building_blocks.items.properties.row.enum) has(row);
  for (const s of amp.status.enum) has(s, 'bb');
  for (const k of amp.evaluation.properties.kind.enum) has(k, 'evaluation');
});

test('orders, verification ladder, coverage and observable kinds are defined', () => {
  for (const o of [...ORDERS, ...common.accuracy.properties.qcd.enum]) has(o);
  for (const s of [...LADDER, ...common.provenance.properties.status.enum]) has(s, 'status');
  for (const c of chan.coverage.enum) has(c, 'coverage');
  for (const k of chan.observables.items.properties.kind.enum) has(k, 'kind');
  for (const t of ['QCD', 'EW', 'mixed', '+PS', 'headline', 'projected', 'preliminary', 'superseded by', 'candidate', 'cand.', 'meas.',
    'theory target', 'theory ÷ experiment', 'may be outdated', 'fiducial', 'LL', 'NLL', 'NNLL', 'N3LL', 'N4LL']) has(t);
});

test('uncertainty categories of both budgets are defined', () => {
  for (const c of common.uncertainty_exp.properties.category.enum) has(c, 'exp');
  for (const c of common.uncertainty_th.properties.category.enum) has(c, 'th');
});

test('accuracy chips resolve, homonyms stay apart', () => {
  const chips = accuracyChips({ qcd: 'NNLO', ew: 'NLO', resummation: [{ accuracy: "N3LL'", variable: 'qT' }, { accuracy: 'N4LLp', variable: 'qT' }], shower_matched: true });
  assert.deepEqual(chips.map((c) => lookup(c)?.id), ['NNLO', 'NLO', 'primed', 'N4LL', '+PS']);
  assert.match(define('NNLO QCD').title, /strong coupling/);
  assert.match(define('NLO EW').title, /electroweak coupling/);
  assert.notEqual(lookup('partial', 'bb'), lookup('partial', 'coverage'));
  assert.notEqual(lookup('numerical', 'evaluation'), lookup('numerical', 'th'));
  assert.equal(lookup('Data'), null);
  assert.equal(lookup('no such label', 'bb'), null);
});

test('approximation notes are scanned for known concepts', () => {
  assert.equal(scan('NNLO in the large-m_t limit').id, 'heavy-top limit');
  assert.equal(scan('NNLO FTapprox rescaled').id, 'FTapprox');
  assert.equal(scan('planar (leading-colour) contributions only').id, 'leading colour');
  assert.equal(scan('ATLAS fiducial cuts and isolation applied with Rivet'), null);
});
