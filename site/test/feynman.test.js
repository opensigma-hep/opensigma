import test from 'node:test';
import assert from 'node:assert/strict';
import { feynmanSvg, diagramSvg, EDGE_TYPES } from '../js/feynman.js';

const spec = (type, extra = {}) => ({
  title: 'q q̄ → Z/γ* → ℓ⁺ℓ⁻',
  points: { a: [0, 1], b: [2, 1], c: [4, 0], d: [4, 2] },
  edges: [{ from: 'a', to: 'b', type, label: 'x<y', ...extra }, { from: 'b', to: 'c', type: 'fermion', label: 'ℓ⁻' }, { from: 'b', to: 'd', type: 'antifermion', label: 'ℓ⁺' }],
});
const paths = (svg, cls) => [...svg.matchAll(new RegExp(`<path class="${cls}" d="([^"]+)"`, 'g'))].map((m) => m[1]);
const nums = (d) => d.match(/-?\d+(\.\d+)?/g).map(Number);

test('every edge type draws one finite path', () => {
  for (const type of EDGE_TYPES) {
    const [d, ...rest] = paths(feynmanSvg(spec(type)), `fd-edge fd-${type}`);
    assert.ok(d, type);
    assert.equal(rest.length, ['fermion', 'antifermion'].includes(type) ? 1 : 0, type); // the fixture's own legs
    assert.ok(nums(d).every(Number.isFinite), type);
  }
});

test('wavy and coiled lines are smooth cubics that start and end on the vertices', () => {
  for (const type of ['photon', 'boson', 'gluon']) {
    const [d] = paths(feynmanSvg(spec(type)), `fd-edge fd-${type}`);
    assert.match(d, /^M0 60C/, type);
    assert.ok(!d.includes('L'), `${type}: no straight segments`);
    assert.deepEqual(nums(d).slice(-2), [120, 60], type);
    assert.ok(d.split('C').length - 1 >= 16, `${type}: several periods`);
  }
  // photon stays within its amplitude; the gluon coil doubles back (x not monotonic)
  const ys = (type) => nums(paths(feynmanSvg(spec(type)), `fd-edge fd-${type}`)[0]).filter((_, i) => i % 2);
  assert.ok(Math.max(...ys('photon').map((y) => Math.abs(y - 60))) <= 8);
  const ends = paths(feynmanSvg(spec('gluon')), 'fd-edge fd-gluon')[0].split('C').slice(1).map((s) => nums(s)[4]);
  assert.ok(ends.some((x, i) => i && x < ends[i - 1]));
});

test('fermion, antifermion and ghost lines carry an arrow; bosons do not', () => {
  const count = (type) => paths(feynmanSvg(spec(type)), 'fd-arrow').length;
  assert.equal(count('photon'), 2); // only the two fixed fermion legs
  assert.equal(count('gluon'), 2);
  assert.equal(count('scalar'), 2);
  assert.equal(count('fermion'), 3);
  assert.equal(count('ghost'), 3);
  // antifermion: the arrow tip points back towards `from`
  const tip = (type) => nums(paths(feynmanSvg(spec(type)), 'fd-arrow')[0])[0];
  assert.ok(tip('fermion') > 60 && tip('antifermion') < 60);
});

test('scalars and ghosts are dashed; strokes follow currentColor', () => {
  assert.match(feynmanSvg(spec('scalar')), /fd-scalar"[^>]*stroke-dasharray/);
  assert.match(feynmanSvg(spec('ghost')), /fd-ghost"[^>]*stroke-dasharray/);
  const svg = feynmanSvg(spec('fermion'));
  assert.match(svg, /stroke="currentColor"/);
  assert.ok(!/#[0-9a-f]{3,6}\b/i.test(svg), 'no hard-coded colours');
});

test('accessible title, escaped labels, dots on internal vertices only', () => {
  const svg = feynmanSvg(spec('boson'));
  assert.match(svg, /^<svg [^>]*role="img"[^>]*><title>Leading-order diagram: q q̄ → Z\/γ\* → ℓ⁺ℓ⁻<\/title>/);
  assert.match(svg, />x&lt;y<\/text>/);
  assert.match(svg, />ℓ⁺<\/text>/);
  assert.equal(svg.match(/<circle/g).length, 1);
});

test('thumbnail: no labels, placement attributes, same title', () => {
  const svg = feynmanSvg(spec('gluon'), { thumb: true, x: 4, y: 5, width: 54, height: 42 });
  assert.ok(!svg.includes('<text'));
  assert.match(svg, / x="4" y="5" width="54" height="42">/);
  assert.match(svg, /<title>Leading-order diagram/);
});

test('unknown edge type, unknown point and zero-length edge throw', () => {
  assert.throws(() => feynmanSvg(spec('graviton')), /unknown edge type "graviton"/);
  assert.throws(() => feynmanSvg({ ...spec('fermion'), points: { a: [0, 1] } }), /unknown point "b"/);
  assert.throws(() => feynmanSvg({ title: 't', points: { a: [0, 0], b: [0, 0] }, edges: [{ from: 'a', to: 'b', type: 'fermion' }] }), /zero-length/);
});

test('diagramSvg: empty string for a process without a diagram', () => {
  const data = { diagrams: { 'proc:x': spec('photon') } };
  assert.match(diagramSvg(data, 'proc:x'), /^<svg/);
  assert.equal(diagramSvg(data, 'proc:new'), '');
  assert.equal(diagramSvg({}, 'proc:x'), '');
});
