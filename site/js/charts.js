// Observable precision history and parameter ideogram. Point builders are pure; draw* use the global d3.
import { ORDERS } from './matrix.js';

const yearOf = (ref, refs) => (ref ? refs[ref.split(', ')[0]]?.year ?? null : null);

/** One point per result (year of the measurement paper) and per prediction with a total (year of the paper the total is from). */
export function historyPoints(obs, meas, refs) {
  const pts = [];
  for (const r of obs.results ?? []) {
    const m = meas[r.measurement];
    const year = m && yearOf(m.ref, refs);
    if (year == null || !(r.total?.value_pct > 0)) continue;
    pts.push({ kind: 'meas', key: m.id, year, pct: r.total.value_pct, label: `${m.experiment} ${m.dataset ?? ''}`.trim(),
      projected: !!m.projected, superseded: !!m.superseded_by });
  }
  (obs.predictions ?? []).forEach((p, i) => {
    const year = yearOf(p.total?.provenance?.ref ?? p.refs?.[0], refs);
    if (year == null || !(p.total?.value_pct > 0)) return;
    pts.push({ kind: 'pred', key: String(i), year, pct: p.total.value_pct, label: p.label, order: p.accuracy.qcd });
  });
  return pts;
}

/** Best (smallest) value so far, per year, as step points; projected measurements are left out. */
export function runningMin(pts) {
  const out = [];
  let best = Infinity;
  for (const p of [...pts].filter((q) => !q.projected).sort((a, b) => a.year - b.year)) {
    if (p.pct < best) { best = p.pct; out.push({ year: p.year, pct: best }); }
  }
  return out;
}

const fmt = (v) => `${+v.toPrecision(2)}`;

function pickable(sel, aria, tip, onPick) {
  sel.attr('tabindex', 0).attr('role', 'button').attr('aria-label', aria)
    .on('click', (_, d) => onPick(d))
    .on('keydown', (e, d) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(d); } });
  sel.append('title').text(tip);
}

/** x = year, y = total uncertainty (%, log); squares = measurements, circles = predictions coloured by QCD order. */
export function drawHistory(el, pts, onPick) {
  const d3 = window.d3;
  el.replaceChildren();
  if (pts.length < 2) return false;
  const W = 640, H = 300, m = { t: 14, r: 16, b: 40, l: 52 };
  const years = d3.extent(pts, (p) => p.year), vals = d3.extent(pts, (p) => p.pct);
  const x = d3.scaleLinear([years[0] - 1, years[1] + 1], [m.l, W - m.r]);
  const y = d3.scaleLog([vals[0] / 1.4, vals[1] * 1.4], [H - m.b, m.t]);
  const svg = d3.select(el).append('svg').attr('class', 'history').attr('viewBox', `0 0 ${W} ${H}`)
    .attr('role', 'group').attr('aria-label', 'Total uncertainty of measurements and predictions by year');
  svg.append('g').attr('class', 'grid').selectAll('line').data(y.ticks(4)).join('line')
    .attr('x1', m.l).attr('x2', W - m.r).attr('y1', y).attr('y2', y);
  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${H - m.b})`)
    .call(d3.axisBottom(x).ticks(Math.min(10, years[1] - years[0] + 2)).tickFormat(d3.format('d')));
  svg.append('g').attr('class', 'axis').attr('transform', `translate(${m.l},0)`)
    .call(d3.axisLeft(y).ticks(4, fmt));
  svg.append('text').attr('class', 'axis-label').attr('transform', `translate(14,${(m.t + H - m.b) / 2}) rotate(-90)`)
    .attr('text-anchor', 'middle').text('Total uncertainty (%)');
  const line = d3.line().curve(d3.curveStepAfter).x((p) => x(p.year)).y((p) => y(p.pct));
  for (const kind of ['meas', 'pred']) {
    const best = runningMin(pts.filter((p) => p.kind === kind));
    if (best.length > 1) svg.append('path').attr('class', `best best-${kind}`).attr('d', line([...best, { ...best.at(-1), year: years[1] + 1 }]));
  }
  const dx = (p) => x(p.year) + (p.kind === 'pred' ? 4 : -4);
  const meas = svg.append('g').selectAll('rect').data(pts.filter((p) => p.kind === 'meas')).join('rect')
    .attr('class', (p) => 'pt-meas' + (p.projected ? ' projected' : '') + (p.superseded ? ' superseded' : ''))
    .attr('x', (p) => dx(p) - 5).attr('y', (p) => y(p.pct) - 5).attr('width', 10).attr('height', 10);
  pickable(meas, (p) => `Measurement ${p.label}, ${p.year}: ${fmt(p.pct)} %${p.projected ? ' (projected)' : ''}. Show row`,
    (p) => `${p.label} (${p.year}): ${fmt(p.pct)} %${p.projected ? ', projected' : ''}`, onPick);
  const pred = svg.append('g').selectAll('circle').data(pts.filter((p) => p.kind === 'pred')).join('circle')
    .attr('class', 'pt-pred').attr('cx', dx).attr('cy', (p) => y(p.pct)).attr('r', 6)
    .attr('fill', (p) => `var(--ord-${ORDERS.indexOf(p.order) + 1})`);
  pickable(pred, (p) => `Prediction ${p.label}, ${p.order} QCD, ${p.year}: ${fmt(p.pct)} %. Show prediction`,
    (p) => `${p.label} (${p.year}, ${p.order} QCD): ${fmt(p.pct)} %`, onPick);
  return true;
}

/** Determinations as value ± uncertainty, one row each, in the given order. */
export function drawIdeogram(el, dets, unit, names, onPick) {
  const d3 = window.d3;
  el.replaceChildren();
  if (!dets.length) return;
  const ROW = 26, W = 640, m = { t: 8, r: 16, b: 36, l: 230 }, H = m.t + m.b + ROW * dets.length;
  const lo = d3.min(dets, (d) => d.value - d.uncertainty), hi = d3.max(dets, (d) => d.value + d.uncertainty);
  const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.01 || 1;
  const x = d3.scaleLinear([lo - pad, hi + pad], [m.l, W - m.r]).nice();
  const svg = d3.select(el).append('svg').attr('class', 'ideogram').attr('viewBox', `0 0 ${W} ${H}`)
    .attr('role', 'group').attr('aria-label', 'Determinations, value with uncertainty');
  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(5));
  if (unit) svg.append('text').attr('class', 'axis-label').attr('x', (m.l + W - m.r) / 2).attr('y', H - 4).attr('text-anchor', 'middle').text(unit);
  const g = svg.append('g').selectAll('g').data(dets.map((d, i) => ({ ...d, i }))).join('g')
    .attr('class', 'det').attr('transform', (d) => `translate(0,${m.t + d.i * ROW + ROW / 2})`);
  const short = (t) => { t = t.replace(' Collaboration', ''); return t.length > 34 ? t.slice(0, 33) + '…' : t; }; // full name stays in the tooltip
  g.append('text').attr('class', 'det-label').attr('x', m.l - 10).attr('dy', '0.32em').attr('text-anchor', 'end').text((d) => short(names[d.i]));
  g.append('line').attr('class', 'err').attr('x1', (d) => x(d.value - d.uncertainty)).attr('x2', (d) => x(d.value + d.uncertainty));
  g.append('circle').attr('class', 'pt').attr('cx', (d) => x(d.value)).attr('r', 5);
  const txt = (d) => `${names[d.i]}: ${d.value} ± ${d.uncertainty}${unit ? ' ' + unit : ''}`;
  pickable(g, (d) => `${txt(d)}. Show row`, txt, onPick);
}

/** Scroll a row or card into view and flash it. */
export function reveal(node) {
  if (!node) return;
  node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  node.classList.remove('flash');
  void node.offsetWidth; // restart the animation
  node.classList.add('flash');
  const f = node.querySelector('a, button, summary') ?? node;
  f.focus?.({ preventScroll: true });
}
