// Runs every pure function over the real site/data.json (built by `python -m scripts.build`); skipped when it is absent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { normalize, search } from '../js/search.js';
import { gaps, nextRun, orderTimeline } from '../js/insights.js';
import { columnsFor, cellState, cellOrder, passes } from '../js/matrix.js';
import { scatterPoints } from '../js/scatter.js';
import { historyPoints, runningMin } from '../js/charts.js';
import { collectBibtex } from '../js/bibtex.js';
import { accuracyChips, fmtSize } from '../js/format.js';
import { refUrl } from '../js/verify-links.js';
import { parseHash } from '../js/router.js';

const file = new URL('../data.json', import.meta.url);
const skip = existsSync(file) ? false : 'site/data.json not built';
const data = skip ? null : JSON.parse(readFileSync(file, 'utf8'));
const t = (name, fn) => test(`real data: ${name}`, { skip }, fn);

function allIds(d) {
  const ids = new Set();
  const add = (n) => ids.add(n.id);
  [d.families, d.amplitudes, d.parameters, d.colliders, d.experiments ?? []].forEach((l) => l.forEach(add));
  for (const p of d.processes) {
    add(p);
    for (const c of p.channels) { add(c); [...(c.measurements ?? []), ...(c.observables ?? [])].forEach(add); }
  }
  return ids;
}
const observables = (d) => d.processes.flatMap((p) => p.channels.flatMap((c) => (c.observables ?? []).map((o) => [p, c, o])));

t('search index ids exist, are unique, and each entry is found by its own id', () => {
  const ids = allIds(data);
  const idx = data.derived.search_index;
  assert.equal(new Set(idx.map((e) => e.id)).size, idx.length);
  for (const e of idx) {
    assert.ok(ids.has(e.id), e.id);
    assert.ok(normalize(e.text).includes(normalize(e.id)), e.id); // findable by its own id
  }
  for (const q of ['Drell-Yan', 'ttbar', 'proc:ttbar', 'LHC', 'alphas', 'gamma', "N3LL'", '2107.09085', 'zzz-no-such-thing']) {
    for (const h of search(idx, q)) assert.ok(ids.has(h.id));
  }
  assert.ok(search(idx, 'Drell-Yan').length > 0);
  assert.equal(search(idx, 'ttbar')[0].id, 'proc:ttbar');
  assert.ok(search(idx, 'LHC', Infinity).some((h) => h.kind === 'col'));
});

t('every id and alias routes to a page', () => {
  const ids = allIds(data);
  const { aliases, parents } = data.derived;
  for (const id of [...ids, ...Object.keys(aliases)]) {
    if (id.startsWith('exp:')) continue; // routed by the experiments view, when present
    assert.notEqual(parseHash('#/' + encodeURIComponent(id), aliases, ids, parents).view, 'notfound', id);
  }
});

t('gaps and nextRun', () => {
  for (const g of gaps(data)) {
    assert.ok(g.open.length > 0);
    for (const o of g.open) assert.notEqual(o.status, 'done');
  }
  for (const r of nextRun(data)) {
    assert.ok(r.proj > 0 && r.measurement.projected);
    assert.equal(r.ratio, r.th == null ? null : r.th / r.proj);
  }
});

t('timeline milestones are backed by their building-block row', () => {
  const tl = orderTimeline(data, 2026);
  assert.equal(tl.total, data.processes.length);
  assert.ok(tl.milestones.length > 0);
  for (const m of tl.milestones) {
    const row = m.proc.building_blocks.find((r) => r.row === `${m.level} QCD`);
    const years = Object.values(row.cells).flatMap((c) => c.refs ?? []).map((r) => data.refs[r.split(', ')[0]]?.year).filter((y) => y != null);
    assert.ok(m.year >= Math.min(...years) && m.year <= Math.max(...years), `${m.proc.id} ${m.level} ${m.year}`);
    assert.equal(data.refs[m.ref.split(', ')[0]].year, m.year);
    assert.ok(tl.years.includes(m.year));
  }
  for (const [lv, s] of Object.entries(tl.series)) {
    assert.equal(s.length, tl.years.length);
    s.forEach((v, i) => assert.ok(v <= tl.total && (i === 0 || v >= s[i - 1]), lv));
    s.forEach((v, i) => assert.ok(v <= tl.series.NLO[i])); // a process at >= NNLO is also at >= NLO
    assert.ok(s.at(-1) >= tl.milestones.filter((m) => m.level === lv).length);
  }
});

t('matrix cells', () => {
  const { cells, family_processes } = data.derived;
  const any = { minOrder: 'any', minStatus: 'any', hasTarget: false };
  for (const c of Object.values(cells)) {
    for (const proj of [false, true]) assert.equal(typeof cellState(c, proj).label, 'string');
    assert.ok(passes(c, any));
    const ord = cellOrder(c);
    assert.ok(ord === null || /^(LO|NLO|NNLO|N3LO|N4LO) (QCD|EW)$/.test(ord), ord);
  }
  for (const f of data.families) {
    const cols = columnsFor(family_processes[f.id], cells, data.colliders);
    assert.ok(cols.every((c, i) => i === 0 || cols[i - 1].order <= c.order));
  }
});

t('scatter, history, chips, sizes, ref links, bibtex', () => {
  const sum = data.derived.observable_summary;
  for (const proj of [false, true]) for (const p of scatterPoints(sum, proj)) assert.ok(p.x > 0 && p.y > 0 && p.id in sum);
  for (const [, chan, obs] of observables(data)) {
    const meas = Object.fromEntries((chan.measurements ?? []).map((m) => [m.id, m]));
    const pts = historyPoints(obs, meas, data.refs);
    for (const p of pts) assert.ok(Number.isInteger(p.year) && p.pct > 0);
    assert.ok(runningMin(pts).length <= pts.length);
    for (const p of obs.predictions ?? []) {
      const chips = accuracyChips(p.accuracy);
      assert.ok(chips.length > 0 && chips.every((c) => c && !c.includes('undefined')), obs.id);
      for (const r of p.refs) assert.notEqual(refUrl(r), '', r);
      for (const u of p.uncertainties ?? []) assert.doesNotMatch(fmtSize(u.size), /NaN|undefined/);
    }
    for (const m of chan.measurements ?? []) if (m.hepdata) assert.match(refUrl(m.hepdata), /^https:\/\/www\.hepdata\.net\/record\/ins\d+/, m.hepdata);
    for (const r of obs.results ?? []) for (const u of r.uncertainties ?? []) assert.doesNotMatch(fmtSize(u.size), /NaN|undefined/);
  }
  for (const p of data.processes) assert.equal(typeof collectBibtex(p, data.refs), 'string');
  assert.ok(collectBibtex(data.processes, data.refs).length > 0);
});

t('only tagged candidates are shipped, matching the per-cell counts', () => {
  const n = {};
  for (const list of Object.values(data.candidates)) {
    for (const c of list) {
      assert.deepEqual(Object.keys(c).sort(), ['arxiv', 'channels', 'recid', 'title']);
      assert.ok(c.channels.length > 0);
      for (const ch of c.channels) n[ch] = (n[ch] ?? 0) + 1;
    }
  }
  for (const [id, c] of Object.entries(data.derived.cells)) assert.equal(c.candidates, n[id] ?? 0, id);
});
