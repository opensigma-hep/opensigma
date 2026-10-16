// DOM helpers shared by the leaf views (observable, channel, process, amplitude, parameter).
import { toHash } from './router.js';
import { statusBadge } from './format.js';
import { issueUrl, refUrl } from './verify-links.js';
import { REPO } from './config.js';

export const BB_COLS = ['born', '1L', '2L', '3L', 'RV', 'RR', 'RRR', 'ir_scheme', 'code'];

export function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e[k] = v;
  e.append(...kids.flat().filter((k) => k != null));
  return e;
}
export const none = (what) => el('p', { className: 'none-yet' }, `No ${what} yet.`);
export const link = (id, text) => el('a', { href: toHash(id) }, text ?? id);
export const sep = (nodes, s = ', ') => nodes.flatMap((n, i) => (i ? [s, n] : [n]));

const IDX = new WeakMap();
/** id -> {node, label, kind, proc, chan}, built once per data object. */
export function index(data) {
  if (IDX.has(data)) return IDX.get(data);
  const m = new Map();
  const col = Object.fromEntries((data.colliders ?? []).map((c) => [c.id, c.name]));
  for (const f of data.families ?? []) m.set(f.id, { node: f, label: f.name, kind: 'fam' });
  for (const a of data.amplitudes ?? []) m.set(a.id, { node: a, label: a.id, kind: 'amp' });
  for (const p of data.parameters ?? []) m.set(p.id, { node: p, label: p.name, kind: 'par' });
  for (const p of data.processes ?? []) {
    m.set(p.id, { node: p, label: p.name, kind: 'proc' });
    for (const c of p.channels ?? []) {
      m.set(c.id, { node: c, label: `${p.name} — ${col[c.collider] ?? c.collider}`, kind: 'chan', proc: p });
      for (const x of c.measurements ?? []) m.set(x.id, { node: x, label: `${x.experiment} ${x.dataset}`, kind: 'meas', proc: p, chan: c });
      for (const o of c.observables ?? []) m.set(o.id, { node: o, label: o.name, kind: 'obs', proc: p, chan: c });
    }
  }
  IDX.set(data, m);
  return m;
}
export const label = (data, id) => index(data).get(id)?.label ?? id;
export const idLink = (data, id) => link(id, label(data, id));

export function breadcrumb(data, id) {
  const chain = [];
  for (let p = data.derived.parents[id]; p; p = data.derived.parents[p]) chain.unshift(p);
  const nav = el('nav', { className: 'crumbs' });
  nav.setAttribute('aria-label', 'Breadcrumb');
  nav.append(...sep([link('', 'Families'), ...chain.map((p) => idLink(data, p))], ' › '));
  return nav;
}

/** "Alpha and Beta (2021)" linking to arXiv/INSPIRE/HEPData; unknown refs show the raw string. */
export function refLink(ref, refs) {
  const [key, ...loc] = ref.split(', ');
  const hd = /^hepdata:ins(\d+)\/(.+)$/.exec(key);
  const r = refs[hd ? 'inspire:' + hd[1] : key];
  const text = hd ? `HEPData ${hd[2]}` : r ? `${r.authors_short} (${r.year})` : key;
  const a = el('a', { href: refUrl(ref), textContent: text + (loc.length ? ', ' + loc.join(', ') : '') });
  if (r?.title) a.title = r.title;
  return a;
}
export const refList = (refs, all) => (refs?.length ? sep(refs.map((r) => refLink(r, all))) : ['none']);

/** Status badge plus ✓/⚑ new-issue links for one provenance record; `value` is the number as displayed. */
export function prov(p, value, fullTable) {
  if (!p) return el('span', { className: 'prov' }, statusEl(undefined));
  const linkTo = [p.ref, fullTable].filter(Boolean).map(refUrl).filter(Boolean).join(' ');
  const datum = { uid: p.uid, value, locator: p.locator, link: linkTo, page: location.hash };
  const act = (action, sym, verb) => {
    const a = el('a', { className: 'vf', href: issueUrl(REPO, action, datum), target: '_blank', rel: 'noopener', textContent: sym });
    a.setAttribute('aria-label', `${verb} ${value} (${p.uid}, ${p.locator})`);
    a.title = `${verb} this value on GitHub`;
    return a;
  };
  const s = el('span', { className: 'prov' }, statusEl(p.status));
  if (p.status === 'human-verified' && p.verified_by) s.append(` by ${p.verified_by}`);
  if (p.status === 'disputed' && p.issue) s.append(' ', el('a', { href: p.issue, textContent: 'issue' }));
  s.append(' ', act('verify', '✓', 'Verify'), ' ', act('flag', '⚑', 'Flag'));
  s.title = `${p.ref}, ${p.locator} · ${p.source}, ${p.date}`;
  return s;
}
function statusEl(status) {
  const b = statusBadge(status);
  return el('span', { className: b.cls }, b.label);
}

/** Process building-block matrix: rows as given, the fixed column set, empty cells for missing entries. */
export function bbTable(proc, refs) {
  const rows = proc.building_blocks ?? [];
  if (!rows.length) return none('building blocks');
  const t = el('table', { className: 'bb' },
    el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Correction'), ...BB_COLS.map((c) => el('th', { scope: 'col' }, c)))));
  const body = el('tbody');
  for (const r of rows) {
    const tr = el('tr', {}, el('th', { scope: 'row' }, r.row));
    for (const c of BB_COLS) {
      const cell = r.cells?.[c];
      if (!cell) { tr.append(el('td', { className: 'empty' })); continue; }
      tr.append(el('td', { className: 'bb-' + cell.status },
        cell.amplitude ? link(cell.amplitude, cell.status) : cell.status,
        cell.approximations?.length ? el('div', { className: 'small' }, cell.approximations.join(', ')) : null,
        cell.refs?.length ? el('div', { className: 'small' }, ...refList(cell.refs, refs)) : null,
        el('div', {}, prov(cell.provenance, `${r.row} ${c}: ${cell.status}`))));
    }
    body.append(tr);
  }
  t.append(body);
  return el('div', { className: 'matrix-scroll' }, t);
}

/** Button that copies getText() to the clipboard, falling back to a selected textarea. */
export function copyButton(text, getText) {
  const out = el('span', { className: 'copy-out' });
  out.setAttribute('aria-live', 'polite');
  const b = el('button', { type: 'button', className: 'btn', textContent: text });
  b.addEventListener('click', async () => {
    const s = getText();
    if (!s) { out.replaceChildren('Nothing to copy.'); return; }
    try {
      await navigator.clipboard.writeText(s);
      out.replaceChildren('Copied.');
    } catch {
      const ta = el('textarea', { value: s, readOnly: true, rows: Math.min(12, s.split('\n').length + 1), className: 'copy-fallback' });
      ta.setAttribute('aria-label', 'Copy this text manually');
      out.replaceChildren('Clipboard unavailable; copy manually:', ta);
      ta.focus();
      ta.select();
    }
  });
  return el('span', { className: 'copy' }, b, out);
}

export function facts(pairs) {
  const dl = el('dl', { className: 'facts' });
  for (const [k, v] of pairs) if (v != null && v !== '') dl.append(el('dt', {}, k), el('dd', {}, v));
  return dl;
}

export function measTable(data, rows) {
  // rows: [{m, total?}]; `total` (the observable's result for m) adds a Total column.
  const refs = data.refs;
  const withTotal = rows.some((r) => r.total);
  const t = el('table', { className: 'meas' }, el('thead', {}, el('tr', {},
    ...['Experiment', 'Dataset', ...(withTotal ? ['Total'] : []), 'Paper', 'HEPData', 'Notes'].map((h) => el('th', { scope: 'col' }, h)))));
  const body = el('tbody');
  for (const { m, total } of rows) {
    const notes = [];
    if (m.projected) notes.push(el('span', {}, 'projected', m.projection_source ? [' (', refLink(m.projection_source.ref, refs), `, ${m.projection_source.date})`] : ''));
    if (m.superseded_by) notes.push(el('span', {}, 'superseded by ', idLink(data, m.superseded_by)));
    if (m.preliminary) notes.push('preliminary');
    if (m.assumptions) notes.push(m.assumptions);
    const cls = [m.projected && 'projected', m.superseded_by && 'superseded', m.preliminary && 'preliminary'].filter(Boolean).join(' ');
    const tr = el('tr', { className: cls },
      el('td', {}, m.experiment), el('td', {}, m.dataset ?? ''),
      ...(withTotal ? [el('td', {}, total ? [`${total.value_pct} %`, el('br'), prov(total.provenance, `${total.value_pct} %`)] : '—')] : []),
      el('td', {}, refLink(m.ref, refs)),
      el('td', {}, m.hepdata ? el('a', { href: refUrl(m.hepdata), textContent: 'HEPData' }) : '—'),
      el('td', {}, ...sep(notes, '; ')));
    body.append(tr);
  }
  t.append(body);
  return el('div', { className: 'table-scroll' }, t);
}
