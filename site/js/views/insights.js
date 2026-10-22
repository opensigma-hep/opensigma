import { el, fill, link, idLink, index, none } from '../leaf.js';
import { gaps as findGaps, nextRun as rankNext, orderTimeline } from '../insights.js';
import { ORDERS } from '../matrix.js';
import { drawTimeline } from '../charts.js';
import { toHash } from '../router.js';

const table = (head, rows) => el('div', { className: 'table-scroll' }, el('table', { className: 'meas' },
  el('thead', {}, el('tr', {}, ...head.map((h) => el('th', { scope: 'col' }, h)))), el('tbody', {}, ...rows)));
const r2 = (v) => (v == null ? '—' : String(+v.toFixed(2)));

/** Open building blocks, ranked by how much theory limits the process today. */
export function gaps(main, data) {
  const list = findGaps(data);
  fill(main,
    el('h1', {}, 'Gap finder'),
    el('p', {}, 'Building blocks that are partial or missing, per process. Processes come first where theory limits precision most: the worst theory ÷ experiment ratio over their channels (above 1, theory is the bottleneck). Processes without a ratio follow, by number of gaps.'),
    el('p', { className: 'small' }, `${list.reduce((n, g) => n + g.open.length, 0)} open cells in ${list.length} processes. Select a process for its full building-block grid.`),
    list.length ? table(['Process', 'Worst theory ÷ exp.', 'Open building blocks'], list.map((g) => el('tr', {},
      el('th', { scope: 'row' }, link(g.proc.id, g.proc.name)),
      el('td', {}, g.worst ? link(g.worst.chan, r2(g.worst.ratio)) : '—'),
      el('td', {}, el('ul', { className: 'chips' }, ...g.open.map((o) => {
        const c = el('li', { className: `chip gap-${o.status}` }, `${o.row} · ${o.col}: ${o.status}`);
        if (o.approximations.length) c.title = o.approximations.join(', ');
        return c;
    })))))) : none('gaps'),
  );
}

/** Projected measurements against today's theory on the same observable. */
export function nextRun(main, data) {
  const rows = rankNext(data);
  const col = (id) => index(data).get(id)?.label ?? id;
  fill(main,
    el('h1', {}, 'Next-run ranking'),
    el('p', {}, 'Observables with a projected measurement (HL-LHC, EIC, …), ranked by today’s headline theory uncertainty divided by the projected experimental one. Above 1, theory must improve before the data arrives. Theory is only taken from the same observable; where it has none, that missing estimate is itself the gap.'),
    el('p', { className: 'small' }, `${rows.length} observable${rows.length === 1 ? '' : 's'} carry a projection so far. Add one with the “projected” flag on a measurement.`),
    rows.length ? table(['Observable', 'Collider', 'Projected exp.', 'Theory today', 'Theory ÷ projected', 'Theory target'], rows.map((r) => el('tr', {},
      el('th', { scope: 'row' }, link(r.obs.id, r.obs.name), el('div', { className: 'small' }, r.proc.name)),
      el('td', {}, link(r.chan.collider, col(r.chan.collider))),
      el('td', {}, `${r.proj} %`, el('div', { className: 'small' }, `${r.measurement.experiment} ${r.measurement.dataset ?? ''}`)),
      el('td', {}, r.th == null ? 'no estimate yet' : `${r.th} %`),
      el('td', {}, r.ratio == null ? '—' : el('strong', { className: r.ratio > 1 ? 'bad' : '' }, r2(r.ratio))),
      el('td', {}, r.target?.required_total ?? '—')))) : none('projections'),
  );
}

/** Theory progress across the catalogue. */
export function timeline(main, data) {
  const tl = orderTimeline(data);
  const plot = el('div', { className: 'history-wrap timeline-wrap' });
  drawTimeline(plot, tl, (ms) => { location.hash = toHash(ms.obs.id); });
  const lvls = Object.keys(tl.series);
  fill(main,
    el('h1', {}, 'Theory progress'),
    el('p', {}, `How many of the ${tl.total} channels had a prediction at each QCD order, year by year. Dots mark the first time a process reached an order; select one to open the observable that shows it.`),
    el('p', { className: 'small' }, 'Year = earliest reference cited by the prediction, so it tracks when the calculation appeared, not when an experiment first compared to it.'),
    plot,
    el('p', { className: 'legend' }, ...lvls.map((lv) => {
      const sw = el('span', { className: `tl-key tl-${lv}` });
      sw.style.setProperty('--c', `var(--ord-${ORDERS.indexOf(lv) + 1})`);
      return el('span', {}, sw, `≥ ${lv}`);
    })),
    el('h2', {}, 'Milestones'),
    tl.milestones.length ? table(['Year', 'Process', 'Order', 'First shown in'], [...tl.milestones].reverse().map((ms) => el('tr', {},
      el('td', {}, String(ms.year)), el('th', { scope: 'row' }, link(ms.proc.id, ms.proc.name)), el('td', {}, ms.level),
      el('td', {}, idLink(data, ms.obs.id), el('div', { className: 'small' }, ms.label))))) : none('predictions with dated references'),
  );
}
