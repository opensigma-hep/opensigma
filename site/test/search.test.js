import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, search } from '../js/search.js';

const idx = [
  { id: 'obs:a', kind: 'obs', label: 'pT of the lepton pair', text: 'gamma spectrum' },
  { id: 'proc:dy', kind: 'proc', label: 'Z/γ* → ℓℓ', text: 'Drell–Yan' },
  { id: 'par:as', kind: 'par', label: 'αs', text: 'strong coupling' },
  { id: 'amp:x', kind: 'amp', label: 'amp:2L/0-qqbarV', text: 'amp:2L/0-qqbarV 2107.09085' },
  { id: 'obs:n', kind: 'obs', label: "N3LL′ resummation", text: '' },
  { id: 'chan:g', kind: 'chan', label: 'gamma production', text: '' },
  { id: 'obs:s', kind: 'obs', label: 'σ at √s = 13 TeV', text: '' },
];
const ids = (q) => search(idx, q).map((e) => e.id);

test('normalize unifies notation', () => {
  assert.equal(normalize('N3LL′'), normalize("N3LL'"));
  for (const s of ['αs', 'alpha_s', 'alphas', 'Alpha s']) assert.equal(normalize(s), 'alphas');
  assert.equal(normalize('√s'), 'sqrts');
  assert.equal(normalize('ℓℓ'), 'll');
  assert.equal(normalize('−1'), '-1');
  assert.equal(normalize('é'), 'e');
});
test('ASCII queries find Unicode labels', () => {
  assert.ok(ids('gamma').includes('proc:dy'));
  assert.deepEqual(ids('alphas'), ['par:as']);
  assert.ok(ids('ll').includes('proc:dy'));
  assert.deepEqual(ids("n3ll'"), ['obs:n']);
  assert.deepEqual(ids('sqrts'), ['obs:s']);
});
test('arXiv id found in text', () => assert.deepEqual(ids('2107.09085'), ['amp:x']));
test('all tokens must match', () => {
  assert.deepEqual(ids('gamma z'), ['proc:dy']);
  assert.deepEqual(ids('gamma nonsense'), []);
});
test('label prefix < label substring < text-only; then kind order', () => {
  // chan:g label starts with gamma; proc:dy contains it; obs:a only in text
  assert.deepEqual(ids('gamma'), ['chan:g', 'proc:dy', 'obs:a']);
  const tie = [{ id: 'obs:1', kind: 'obs', label: 'x', text: '' }, { id: 'proc:1', kind: 'proc', label: 'x', text: '' },
               { id: 'obs:2', kind: 'obs', label: 'x', text: '' }];
  assert.deepEqual(search(tie, 'x').map((e) => e.id), ['proc:1', 'obs:1', 'obs:2']);
});
test('empty query and limit', () => {
  assert.deepEqual(search(idx, '  '), []);
  assert.equal(search(idx, 'a', 2).length, 2);
});
