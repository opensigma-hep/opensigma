import { el, fill, link, index, none, refLink } from '../leaf.js';
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
  drawTimeline(plot, tl, (ms) => { location.hash = toHash(ms.proc.id); });
  const lvls = Object.keys(tl.series);
  fill(main,
    el('h1', {}, 'Theory progress'),
    el('p', {}, `How many of the ${tl.total} processes had reached each QCD order, year by year. Dots mark the year a process reached an order; select one to open the process and its building-block grid.`),
    el('p', { className: 'small' }, 'Read from the building-block grid, not from the predictions: a process reaches an order when the “code” cell (combined calculation or public code) of that order’s row is done, in the year of that cell’s earliest reference. An NLO row without a code cell counts once all its recorded cells are done, in the year the last of them appeared. Rows whose code cell is partial, or that record only amplitudes beyond NLO, are not counted, so this errs on the late side. A line counts a process from the first year it reached that order or a higher one.'),
    plot,
    el('p', { className: 'legend' }, ...lvls.map((lv) => {
      const sw = el('span', { className: `tl-key tl-${lv}` });
      sw.style.setProperty('--c', `var(--ord-${ORDERS.indexOf(lv) + 1})`);
      return el('span', {}, sw, `≥ ${lv}`);
    })),
    el('h2', {}, 'Milestones'),
    tl.milestones.length ? table(['Year', 'Process', 'Order', 'Dated by'], [...tl.milestones].reverse().map((ms) => el('tr', {},
      el('td', {}, String(ms.year)), el('th', { scope: 'row' }, link(ms.proc.id, ms.proc.name)), el('td', {}, `${ms.level} QCD`),
      el('td', {}, refLink(ms.ref, data.refs))))) : none('completed building-block rows with dated references'),
  );
}
