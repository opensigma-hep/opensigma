import { el, none, link, idLink, index, breadcrumb, refLink, refList, prov, bbTable, copyButton, facts, measTable, sep } from '../leaf.js';
import { accuracyChips, fmtSize, parseRegionValue } from '../format.js';
import { collectBibtex } from '../bibtex.js';

// Which experimental result the budget shows; kept while the observable stays the same.
let S = { id: null, i: 0 };

const section = (title, ...kids) => el('section', { className: 'leaf' }, el('h2', {}, title), ...kids);
const pct = (v) => `${v} %`;

export function render(main, data, route) {
  const { node: obs, chan, proc } = index(data).get(route.id);
  const cell = data.derived.cells[chan.id] ?? {};
  const meas = Object.fromEntries((chan.measurements ?? []).map((m) => [m.id, m]));
  const results = (obs.results ?? []).filter((r) => meas[r.measurement]);
  const preds = obs.predictions ?? [];
  const head = preds.find((p) => p.headline) ?? preds[0];
  const sum = data.derived.observable_summary?.[obs.id] ?? {};
  const best = results.find((r) => sum.exp_pct != null && r.total.value_pct === sum.exp_pct);
  if (S.id !== obs.id) S = { id: obs.id, i: Math.max(0, results.indexOf(best)) };

  main.replaceChildren(
    breadcrumb(data, obs.id),
    el('h1', {}, obs.name),
    facts([
      ['Kind', obs.kind], ['Variable', obs.variable],
      ['Channel coverage', chan.coverage],
      ['Last reviewed', chan.last_reviewed + (cell.stale ? ' (may be outdated)' : '')],
      ['Candidate papers not yet incorporated', String(cell.candidates ?? 0)],
      ['Headline region', chan.headline?.observable === obs.id ? chan.headline.region : null],
    ]),
    el('div', { className: 'actions' },
      copyButton('Copy link', () => location.href),
      copyButton('Copy BibTeX', () => collectBibtex([obs, ...results.map((r) => meas[r.measurement])], data.refs))),
    section('Headline', headline(data, sum, head, best, obs.theory_target)),
    section('Measurements', results.length ? measTable(data, results.map((r) => ({ m: meas[r.measurement], total: r.total }))) : none('measurements')),
    section('Uncertainty budget', budget(data, results, meas, head)),
    section('Predictions', ...predictions(data, preds), ...ingredients(data, obs.resummation_ingredients)),
    section('Building blocks', el('details', {}, el('summary', {}, `${proc.name}: building-block matrix`), bbTable(proc, data.refs))),
  );
}

function headline(data, sum, head, best, target) {
  const tnum = parseFloat(target?.required_total);
  const rows = [
    ['Theory (headline prediction)', sum.th_pct, sum.th_pct != null && pct(sum.th_pct), head?.total?.provenance],
    ['Best experiment', sum.exp_pct, sum.exp_pct != null && pct(sum.exp_pct), best?.total?.provenance],
    ['Theory target (required)', Number.isFinite(tnum) ? tnum : null, target?.required_total, target?.provenance],
  ];
  const max = Math.max(...rows.map((r) => r[1] ?? 0));
  const strip = el('div', { className: 'strip' });
  for (const [name, v, text, p] of rows) {
    const bar = el('div', { className: 'strip-track' });
    if (v != null && max > 0) {
      const fill = el('div', { className: 'strip-bar' });
      fill.style.width = `${(100 * v) / max}%`;
      bar.append(fill);
    }
    strip.append(el('div', { className: 'strip-row' },
      el('div', { className: 'strip-label' }, name, ': ', el('strong', {}, text || 'none yet'), text ? [' ', prov(p, text)] : null),
      bar));
  }
  if (target) strip.append(el('p', { className: 'small' }, 'Target source: ', refLink(target.source, data.refs),
    target.current_total ? ` · current total quoted there: ${target.current_total}` : ''));
  return strip;
}

/** Uncertainties grouped by category; v = quadrature sum of the upper ends of the % ones (0 if none). */
function groups(uncs) {
  const g = new Map();
  for (const u of uncs ?? []) {
    if (!g.has(u.category)) g.set(u.category, []);
    g.get(u.category).push(u);
  }
  return [...g].map(([cat, items]) => ({ cat, items, v: Math.hypot(...items.filter((u) => (u.size.unit ?? '%') === '%').map((u) => u.size.range[1])) }));
}

function budget(data, results, meas, head) {
  const wrap = el('div');
  const draw = () => {
    const r = results[S.i];
    const bars = [];
    if (r) bars.push({ name: `Experiment: ${meas[r.measurement].experiment} ${meas[r.measurement].dataset ?? ''}`, total: r.total.value_pct, groups: groups(r.uncertainties) });
    if (head?.uncertainties?.length) bars.push({ name: `Theory: ${head.label}`, total: head.total?.value_pct, groups: groups(head.uncertainties) });
    wrap.replaceChildren();
    if (results.length > 1) {
      const s = el('select', {}, ...results.map((x, i) => el('option', { value: i, selected: i === S.i, textContent: `${meas[x.measurement].experiment} ${meas[x.measurement].dataset ?? ''}` })));
      s.addEventListener('change', () => { S.i = +s.value; draw(); });
      wrap.append(el('label', { className: 'pick' }, 'Experimental result: ', s));
    }
    if (!bars.some((b) => b.groups.length)) { wrap.append(none('uncertainty breakdown')); return; }
    const color = window.d3.scaleOrdinal(window.d3.schemeTableau10);
    const lists = bars.map((b) => details(data, b, color));
    wrap.append(chart(bars, lists, color),
      el('p', { className: 'small' }, 'Each segment is one category (its entries combined in quadrature, upper end of each range); segments are stacked linearly, so the bar is not the quoted total, which is marked by the tick. Select a segment for the breakdown.'),
      ...lists.map((l) => l.el));
  };
  draw();
  return wrap;
}

function chart(bars, lists, color) {
  const d3 = window.d3;
  const W = 600, L = 16, R = 20, ROW = 58, H = bars.length * ROW + 26;
  const max = d3.max(bars, (b) => Math.max(d3.sum(b.groups, (g) => g.v), b.total ?? 0)) || 1;
  const x = d3.scaleLinear().domain([0, max]).nice().range([L, W - R]);
  const svg = d3.create('svg').attr('class', 'budget').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'group')
    .attr('aria-label', 'Uncertainty budget by category');
  bars.forEach((b, i) => {
    const g = svg.append('g').attr('transform', `translate(0,${i * ROW})`);
    g.append('text').attr('x', L).attr('y', 16).text(b.name);
    let x0 = 0;
    for (const grp of b.groups.filter((s) => s.v > 0)) {
      const seg = g.append('rect').attr('class', 'seg').attr('x', x(x0)).attr('y', 24).attr('height', 22)
        .attr('width', Math.max(1, x(x0 + grp.v) - x(x0))).attr('fill', color(grp.cat))
        .attr('tabindex', 0).attr('role', 'button').attr('aria-label', `${b.name}, ${grp.cat}: ${+grp.v.toFixed(3)} %. Show details`);
      seg.append('title').text(`${grp.cat}: ${+grp.v.toFixed(3)} %`);
      const open = () => lists[i].open(grp.cat);
      seg.on('click', open).on('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      x0 += grp.v;
    }
    if (b.total != null) {
      g.append('line').attr('class', 'tick-total').attr('x1', x(b.total)).attr('x2', x(b.total)).attr('y1', 20).attr('y2', 50)
        .append('title').text(`quoted total ${b.total} %`);
    }
  });
  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${bars.length * ROW})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat((v) => `${v} %`));
  return svg.node();
}

function regionText(v) {
  try {
    const { up, down } = parseRegionValue(v);
    return up === -down ? `±${up}` : `+${up} / −${-down}`;
  } catch { return v; }
}

function details(data, bar, color) {
  const byCat = new Map();
  const box = el('div', { className: 'budget-list' }, el('h3', {}, bar.name), bar.total != null ? el('p', {}, `Quoted total: ${pct(bar.total)}`) : null);
  for (const g of bar.groups) {
    const sw = el('span', { className: 'swatch' });
    sw.style.background = color(g.cat);
    const d = el('details', {}, el('summary', {}, sw, ` ${g.cat}`, g.v > 0 ? ` · ${+g.v.toFixed(3)} %` : ''),
      el('ul', {}, ...g.items.map((u) => el('li', {},
        el('strong', {}, u.specific ?? u.category), ': ', fmtSize(u.size), u.size.asymmetric ? ' (asymmetric)' : '', ' ',
        prov(u.provenance, fmtSize(u.size), u.full_table),
        facts([
          ['Method', u.method], ['PDF set', u.pdf_set],
          ['Regions', u.size.regions?.length ? sep(u.size.regions.map((r) => `${r.where}: ${regionText(r.value)}`), '; ') : null],
          ['Locator', `${u.provenance.ref}, ${u.provenance.locator}`],
          ['Full table', u.full_table ? refLink(u.full_table, data.refs) : null],
        ])))));
    byCat.set(g.cat, d);
    box.append(d);
  }
  return {
    el: box,
    open(cat) {
      const d = byCat.get(cat);
      d.open = true;
      d.querySelector('summary').focus();
    },
  };
}

function predictions(data, preds) {
  if (!preds.length) return [none('predictions')];
  return preds.map((p) => el('article', { className: 'pred' },
    el('h3', {}, p.label, p.headline ? el('span', { className: 'chip head' }, 'headline') : null),
    el('ul', { className: 'chips' }, ...accuracyChips(p.accuracy).map((c) => el('li', { className: 'chip' }, c))),
    facts([
      ['Total', p.total ? [pct(p.total.value_pct), ' ', prov(p.total.provenance, pct(p.total.value_pct))] : null],
      ['Codes', p.codes?.length ? p.codes.join(', ') : null],
      ['Uses amplitudes', p.uses_amplitudes?.length ? sep(p.uses_amplitudes.map((a) => link(a))) : null],
      ['Compared to', p.compared_to?.length ? sep(p.compared_to.map((m) => idLink(data, m))) : null],
      ['References', refList(p.refs, data.refs)],
      ['Record', prov(p.provenance, p.label)],
    ])));
}

function ingredients(data, list) {
  if (!list?.length) return [];
  return [el('h3', {}, 'Resummation ingredients'), el('ul', { className: 'ingredients' }, ...list.map((r) => el('li', {},
    el('strong', {}, r.name), `: ${r.status} · `, ...refList(r.refs, data.refs), ' ', prov(r.provenance, `${r.name}: ${r.status}`))))];
}
