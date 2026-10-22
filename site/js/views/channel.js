import { el, fill, none, link, index, breadcrumb, facts, measTable, candidateList } from '../leaf.js';

export function render(main, data, route) {
  const { node: chan, label, proc } = index(data).get(route.id);
  const cell = data.derived.cells[chan.id] ?? {};
  const sum = data.derived.observable_summary ?? {};
  const meas = chan.measurements ?? [], obs = chan.observables ?? [];
  const pct = (v) => (v == null ? '—' : `${v} %`);
  fill(main,
    breadcrumb(data, chan.id),
    el('h1', {}, label),
    facts([
      ['Collider', link(chan.collider, index(data).get(chan.collider)?.label)],
      ['Initial state', chan.initial_state], ['Coverage', chan.coverage],
      ['Last reviewed', chan.last_reviewed + (cell.stale ? ' (may be outdated)' : '')],
      ['Headline', chan.headline ? [link(chan.headline.observable, index(data).get(chan.headline.observable)?.label), ` (${chan.headline.region})`] : null],
    ]),
    candidateList(data, proc, chan.id),
    el('h2', {}, 'Observables'),
    obs.length ? el('div', { className: 'table-scroll' }, el('table', { className: 'meas' },
      el('thead', {}, el('tr', {}, ...['Observable', 'Kind', 'Results', 'Predictions', 'Theory (headline)', 'Best exp.'].map((h) => el('th', { scope: 'col' }, h)))),
      el('tbody', {}, ...obs.map((o) => el('tr', {},
        el('th', { scope: 'row' }, link(o.id, o.name), o.id === chan.headline?.observable ? el('span', { className: 'chip head' }, 'headline') : null),
        el('td', {}, o.kind), el('td', {}, String((o.results ?? []).length)), el('td', {}, String((o.predictions ?? []).length)),
        el('td', {}, pct(sum[o.id]?.th_pct)), el('td', {}, pct(sum[o.id]?.exp_pct))))))) : none('observables'),
    el('h2', {}, 'Measurements'),
    meas.length ? measTable(data, meas.map((m) => ({ m }))) : none('measurements'),
  );
}
