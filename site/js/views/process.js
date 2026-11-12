import { el, fill, none, link, idLink, index, breadcrumb, facts, bbTable, sep, term, accChips } from '../leaf.js';
import { diagramSvg } from '../feynman.js';

export function render(main, data, route) {
  const proc = index(data).get(route.id).node;
  const chans = proc.channels ?? [];
  fill(main,
    breadcrumb(data, proc.id),
    el('h1', {}, proc.name),
    el('div', { className: 'proc-intro' }, proc.description ? el('p', {}, proc.description) : null, diagramFigure(data, proc.id)),
    facts([['Also in', proc.also_in?.length ? sep(proc.also_in.map((f) => idLink(data, f))) : null]]),
    el('h2', {}, 'Channels'),
    el('p', { className: 'small' }, 'One row per collider: the headline observable, its headline prediction, and the precision of theory and the best experiment. Every observable of a channel is on its channel page.'),
    chans.length ? channelTable(data, chans) : none('channels'),
    el('h2', {}, 'Building blocks'),
    bbTable(proc, data),
  );
}

/** Leading-order diagram with its caption; null for a process that has none yet. */
function diagramFigure(data, id) {
  const d = data.diagrams?.[id];
  if (!d) return null;
  return el('figure', { className: 'feyn' }, el('div', { innerHTML: diagramSvg(data, id) }),
    el('figcaption', {}, el('strong', {}, 'Leading order: '), d.title, d.note ? el('div', { className: 'small' }, d.note) : null));
}

function channelTable(data, chans) {
  const cells = data.derived.cells, sum = data.derived.observable_summary ?? {};
  const pct = (v) => (v == null ? '—' : `${v} %`);
  const order = Object.fromEntries((data.colliders ?? []).map((c) => [c.id, c.order]));
  const head = ['Collider', 'Headline observable', 'Headline prediction', 'Theory', 'Best exp.', 'Theory ÷ exp.', 'Data'];
  const rows = [...chans].sort((a, b) => order[a.collider] - order[b.collider]).map((c) => {
    const cell = cells[c.id] ?? {};
    const h = c.headline && (c.observables ?? []).find((o) => o.id === c.headline.observable);
    const p = h && ((h.predictions ?? []).find((x) => x.headline) ?? null);
    const s = h ? sum[h.id] ?? {} : {};
    const ratio = cell.ratio == null ? '—' : (+cell.ratio.toFixed(2)).toString();
    const data_ = [`${cell.n_measurements ?? 0} meas.`, `${(c.observables ?? []).length} obs.`,
      cell.candidates ? `${cell.candidates} cand.` : null, c.coverage !== 'complete' ? c.coverage : null, cell.stale ? 'may be outdated' : null].filter(Boolean).join(' · ');
    return el('tr', {},
      el('th', { scope: 'row' }, link(c.id, index(data).get(c.collider)?.label ?? c.collider)),
      el('td', {}, h ? link(h.id, h.name) : '—'),
      el('td', {}, p ? [p.label, accChips(p.accuracy)] : '—'),
      el('td', {}, pct(s.th_pct)), el('td', {}, pct(s.exp_pct)), el('td', {}, ratio), el('td', { className: 'small' }, data_));
  });
  return el('div', { className: 'table-scroll' }, el('table', { className: 'meas' },
    el('thead', {}, el('tr', {}, ...head.map((x) => el('th', { scope: 'col' }, term(x))))), el('tbody', {}, ...rows)));
}
