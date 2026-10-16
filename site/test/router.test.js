import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHash, toHash } from '../js/router.js';

test('alias redirects', () => assert.deepEqual(parseHash('#/obs:old', {'obs:old':'obs:new'}, new Set(['obs:new'])), {view:'observable', id:'obs:new', redirected:true}));
test('unknown id → notfound', () => assert.equal(parseHash('#/proc:nope', {}, new Set()).view, 'notfound'));
test('empty → families', () => assert.equal(parseHash('', {}, new Set()).view, 'families'));
test('search query decoded', () => assert.equal(parseHash('#/search?q=N3LL%E2%80%B2', {}, new Set()).q, 'N3LL′'));
test('#/ → families, #/about → about', () => {
  assert.equal(parseHash('#/', {}, new Set()).view, 'families');
  assert.equal(parseHash('#/about', {}, new Set()).view, 'about');
});
test('every id prefix maps to its view', () => {
  const m = {fam:'family', proc:'process', chan:'channel', obs:'observable', amp:'amplitude', par:'parameter', meas:'measurement', col:'collider'};
  for (const [p, view] of Object.entries(m)) {
    const id = `${p}:x`;
    assert.deepEqual(parseHash('#/' + id, {}, new Set([id])), {view, id});
  }
});
test('alias to a missing target → notfound', () => assert.equal(parseHash('#/obs:old', {'obs:old':'obs:gone'}, new Set()).view, 'notfound'));
test('toHash', () => assert.equal(toHash('proc:a/b'), '#/proc:a/b'));
test('search query keeps a literal +', () => {
  assert.equal(parseHash('#/search?q=N3LL+', {}, new Set()).q, 'N3LL+');
  assert.equal(parseHash('#/search?q=a%20b&x=1', {}, new Set()).q, 'a b');
  assert.equal(parseHash('#/search?q=100%', {}, new Set()).q, '100%');
});
