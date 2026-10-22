import { toHash } from '../router.js';
import { ORDERS, LADDER, RATIO_LABELS, columnsFor, cellState, passes } from '../matrix.js';
import { scatterPoints, drawScatter } from '../scatter.js';

// View state lives in the module (no persistence): reset only when the family changes.
let S = null;
const fresh = (id) => ({ id, mode: 'order', proj: false, colliders: null, minOrder: 'any', minStatus: 'any', hasTarget: false, scatter: false });

const CW = 132, CH = 52, LW = 220, HH = 44;

// Label column wide enough for the longest row label (canvas: the host is not in the DOM yet when first drawn).
function labelWidth(texts) {
  const ctx = document.createElement('canvas').getContext('2d');
  return Math.max(LW, ...texts.map(([font, t]) => { ctx.font = font; return Math.ceil(ctx.measureText(t).width) + 16; }));
}

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e[k] = v;
  e.append(...kids);
  return e;
}
const field = (legend, ...kids) => el('fieldset', {}, el('legend', {}, legend), ...kids);
const check = (label, key, redraw) => {
  const i = el('input', { type: 'checkbox', checked: S[key] });
  i.addEventListener('change', () => { S[key] = i.checked; redraw(); });
  return el('label', {}, i, ' ' + label);
};
const radio = (name, label, value, redraw) => {
  const i = el('input', { type: 'radio', name, value, checked: S.mode === value });
  i.addEventListener('change', () => { S.mode = value; redraw(); });
  return el('label', {}, i, ' ' + label);
};
function select(label, key, options, redraw) {
  const s = el('select', {}, ...options.map(([v, t]) => el('option', { value: v, textContent: t, selected: S[key] === v })));
  s.addEventListener('change', () => { S[key] = s.value; redraw(); });
  return field(label, s);
}

function patterns(d3, svg) {
  const defs = svg.append('defs');
  defs.append('pattern').attr('id', 'pm-hatch').attr('width', 7).attr('height', 7).attr('patternUnits', 'userSpaceOnUse')
    .attr('patternTransform', 'rotate(45)').append('line').attr('class', 'pat-line').attr('y2', 7);
  const p = defs.append('pattern').attr('id', 'pm-partial').attr('width', 8).attr('height', 8).attr('patternUnits', 'userSpaceOnUse');
  p.append('circle').attr('class', 'pat-dot').attr('cx', 2).attr('cy', 2).attr('r', 1.4);
  p.append('circle').attr('class', 'pat-dot').attr('cx', 6).attr('cy', 6).attr('r', 1.4);
}

function drawMatrix(host, data, fam, rows, cols, procName, procFam, famName) {
  const d3 = window.d3;
  host.replaceChildren();
  const cells = data.derived.cells, byKey = new Map();
  for (const [id, c] of Object.entries(cells)) byKey.set(c.process + '|' + c.collider, [id, c]);
  const LW = labelWidth(rows.flatMap((p) => [['600 14px system-ui, sans-serif', procName[p]],
    ...(procFam[p] !== fam.id ? [['11px system-ui, sans-serif', `(also in ${famName[procFam[p]]})`]] : [])]));
  const W = LW + cols.length * CW, H = HH + rows.length * CH;
  // Scales down to fit the page (CSS width: 100%), never up; below min-width the host scrolls.
  const svg = d3.select(host).append('svg').attr('class', 'matrix').attr('viewBox', `0 0 ${W} ${H}`)
    .style('max-width', `${W}px`).style('min-width', `min(${W}px, 40rem)`)
    .attr('role', 'group').attr('aria-label', `${fam.name}: processes by collider`);
  patterns(d3, svg);
  svg.append('g').selectAll('a').data(cols).join('a').attr('class', 'colhead').attr('href', (c) => toHash(c.id)).append('text')
    .attr('x', (_, i) => LW + i * CW + CW / 2).attr('y', HH - 14).attr('text-anchor', 'middle').text((c) => c.name);
  const rowG = svg.append('g').selectAll('g').data(rows).join('g').attr('transform', (_, i) => `translate(0,${HH + i * CH})`);
  rowG.append('a').attr('class', 'rowhead').attr('href', (p) => toHash(p)).append('text').attr('x', 8).attr('y', CH / 2 - 2).text((p) => procName[p]);
  rowG.filter((p) => procFam[p] !== fam.id).append('text').attr('class', 'muted').attr('x', 8).attr('y', CH / 2 + 13)
    .text((p) => `(also in ${famName[procFam[p]]})`);
  for (const [r, proc] of rows.entries()) {
    for (const [c, col] of cols.entries()) {
      const hit = byKey.get(proc + '|' + col.id);
      const g = svg.append('g').attr('transform', `translate(${LW + c * CW},${HH + r * CH})`);
      const st = cellState(hit?.[1], S.mode, S.proj);
      if (!hit) { g.append('rect').attr('class', 'none').attr('x', 3).attr('y', 3).attr('width', CW - 6).attr('height', CH - 6).attr('rx', 4)
        .append('title').text('no channel'); continue; }
      const cell = hit[1];
      const a = g.append('a').attr('class', 'cell' + (passes(cell, S) ? '' : ' dim')).attr('href', toHash(hit[0]))
        .attr('aria-label', `${procName[proc]} at ${col.name}: ${st.label}`);
      a.append('title').text(`${procName[proc]} at ${col.name}: ${st.label}`);
      const box = (cls, fill) => a.append('rect').attr('class', cls).attr('x', 2).attr('y', 2).attr('width', CW - 4).attr('height', CH - 4)
        .attr('rx', 4).attr('fill', fill);
      box('base', st.fill);
      if (st.pattern !== 'none') box('tex', `url(#pm-${st.pattern})`);
      const txt = `${cell.n_measurements} meas.` + (cell.candidates > 0 ? ` · ${cell.candidates} cand.` : '');
      a.append('rect').attr('class', 'badge').attr('x', 8).attr('y', CH - 24).attr('width', txt.length * 6 + 10).attr('height', 17).attr('rx', 8);
      a.append('text').attr('class', 'badge-text').attr('x', 13).attr('y', CH - 12).text(txt);
      if (cell.stale) {
        a.append('text').attr('x', CW - 12).attr('y', 18).attr('text-anchor', 'middle').attr('fill', 'var(--fg)')
          .style('font-size', '14px').text('⚠').append('title').text('may be outdated');
      }
    }
  }
}

function legend() {
  const sw = (fill, pat) => {
    const s = el('span');
    s.innerHTML = `<svg viewBox="0 0 22 16" aria-hidden="true"><rect width="22" height="16" fill="${fill}"/>` +
      (pat ? `<rect width="22" height="16" fill="url(#pm-${pat})"/>` : '') + '</svg>';
    return s;
  };
  const item = (fill, pat, text) => { const s = sw(fill, pat); s.append(text); return s; };
  const ord = el('div', { className: 'legend' }, el('span', {}, 'Highest QCD order:'),
    ...ORDERS.map((o, i) => item(`var(--ord-${i + 1})`, null, o)));
  const rat = el('div', { className: 'legend' }, el('span', {}, 'Theory / experiment uncertainty:'),
    ...RATIO_LABELS.map((t, i) => item(`var(--rat-${i + 1})`, null, t)),
    el('span', {}, '< 1: theory more precise · > 1: theory is the bottleneck'));
  const common = el('div', { className: 'legend' },
    item('var(--cell-empty)', 'hatch', 'no value (hatched)'), item('var(--ord-3)', 'partial', 'partial coverage (dotted)'),
    el('span', {}, '⚠ may be outdated'), el('span', {}, 'meas. = measurements, cand. = candidate papers'),
    el('span', {}, 'dashed outline: no channel; faded: excluded by filters'));
  return [S.mode === 'ratio' ? rat : ord, common];
}

export function render(el_, data, route) {
  if (!S || S.id !== route.id) S = fresh(route.id);
  const fam = data.families.find((f) => f.id === route.id);
  el_.replaceChildren();
  const famName = Object.fromEntries(data.families.map((f) => [f.id, f.name]));
  const procName = Object.fromEntries(data.processes.map((p) => [p.id, p.name]));
  const procFam = Object.fromEntries(data.processes.map((p) => [p.id, p.family]));
  const rows = data.derived.family_processes[fam.id] ?? [];
  const h1 = el('h1', {}, fam.name);
  if (!rows.length) {
    el_.append(h1, el('p', {}, 'No processes in this family yet.'), el('a', { href: '#/' }, 'Back to all families'));
    return;
  }
  const allCols = columnsFor(rows, data.derived.cells, data.colliders);
  const host = el('div', { className: 'matrix-scroll', tabIndex: 0 });
  host.setAttribute('role', 'region');
  host.setAttribute('aria-label', `${fam.name} matrix (scrolls horizontally)`);
  const legendHost = el('div');
  const scatterHost = el('div', { className: 'scatter-wrap' });
  const obsName = {}, obsChan = {};
  for (const p of data.processes) for (const c of p.channels) for (const o of c.observables ?? []) { obsName[o.id] = o.name; obsChan[o.id] = c.id; }

  function redraw() {
    const cols = allCols.filter((c) => !S.colliders || S.colliders.has(c.id));
    drawMatrix(host, data, fam, rows, cols, procName, procFam, famName);
    legendHost.replaceChildren(...legend());
    scatterHost.hidden = !S.scatter;
    if (S.scatter) {
      const cells = data.derived.cells, ok = new Set(rows);
      const pts = scatterPoints(data.derived.observable_summary, S.proj).filter((p) => {
        const c = cells[obsChan[p.id]];
        return c && ok.has(c.process) && (!S.colliders || S.colliders.has(c.collider)) && passes(c, S);
      }).map((p) => ({ ...p, name: obsName[p.id] ?? p.id }));
      drawScatter(scatterHost, pts);
    }
  }

  const colChecks = allCols.map((c) => {
    const on = !S.colliders || S.colliders.has(c.id);
    const i = el('input', { type: 'checkbox', checked: on });
    i.addEventListener('change', () => {
      S.colliders ??= new Set(allCols.map((x) => x.id));
      i.checked ? S.colliders.add(c.id) : S.colliders.delete(c.id);
      redraw();
    });
    return el('label', {}, i, ' ' + c.name);
  });
  const controls = el('div', { className: 'controls' },
    field('Colour by', radio('mode', 'QCD order', 'order', redraw), radio('mode', 'Precision ratio', 'ratio', redraw)),
    field('Data', check('Include projections', 'proj', redraw), check('Has theory target', 'hasTarget', redraw), check('Show scatter', 'scatter', redraw)),
    field('Colliders', ...colChecks),
    select('Min. accuracy', 'minOrder', [['any', 'any'], ...ORDERS.map((o) => [o, `≥ ${o}`])], redraw),
    select('Status (all data at least)', 'minStatus', [['any', 'any'], ...LADDER.map((o) => [o, o])], redraw));
  el_.append(h1, controls, host, legendHost, scatterHost);
  redraw();
}
