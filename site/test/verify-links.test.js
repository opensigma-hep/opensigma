import test from 'node:test';
import assert from 'node:assert/strict';
import { issueUrl, refUrl } from '../js/verify-links.js';

const R = 'https://github.com/pheno-map/pheno-map';

test('issue url encodes', () => assert.match(
  issueUrl(R, 'verify', { uid: 'a1b2c3d4', value: '±0.4', locator: 'Table 3, row "scale"', link: 'x', page: '#/obs:a' }),
  /template=verify\.yml&.*uid=a1b2c3d4.*value=%C2%B10\.4/));

test('issue url fields', () => {
  const u = new URL(issueUrl(R, 'flag', { uid: 'a1b2c3d4', value: '1 %', locator: 'Tab & 3', link: 'https://x/y?a=1', page: '#/obs:a/b' }));
  assert.equal(u.origin + u.pathname, R + '/issues/new');
  const q = Object.fromEntries(u.searchParams);
  assert.deepEqual(q, { template: 'flag.yml', title: 'Flag a1b2c3d4', uid: 'a1b2c3d4', value: '1 %', locator: 'Tab & 3', link: 'https://x/y?a=1', page: '#/obs:a/b' });
});

test('refUrl', () => {
  assert.equal(refUrl('arXiv:2001.00001, Fig. 3'), 'https://arxiv.org/abs/2001.00001');
  assert.equal(refUrl('arXiv:hep-ph/0201206'), 'https://arxiv.org/abs/hep-ph/0201206');
  assert.equal(refUrl('inspire:1000001'), 'https://inspirehep.net/literature/1000001');
  assert.equal(refUrl('hepdata:ins1000001/Table 2'), 'https://www.hepdata.net/record/ins1000001?table=Table%202');
  assert.equal(refUrl('nonsense'), '');
});
