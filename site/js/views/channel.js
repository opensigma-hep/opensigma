import { el, none, link, index, breadcrumb, facts, measTable } from '../leaf.js';

export function render(main, data, route) {
  const { node: chan, label } = index(data).get(route.id);
  const cell = data.derived.cells[chan.id] ?? {};
  const sum = data.derived.observable_summary ?? {};
  const meas = chan.measurements ?? [], obs = chan.observables ?? [];
  const pctOr = (v) => (v == null ? 'none yet' : `${v} %`);
  main.replaceChildren(
    breadcrumb(data, chan.id),
    el('h1', {}, label),
    facts([
      ['Initial state', chan.initial_state], ['Coverage', chan.coverage],
      ['Last reviewed', chan.last_reviewed + (cell.stale ? ' (may be outdated)' : '')],
      ['Candidate papers not yet incorporated', String(cell.candidates ?? 0)],
      ['Headline', chan.headline ? [link(chan.headline.observable, index(data).get(chan.headline.observable)?.label), ` (${chan.headline.region})`] : null],
    ]),
    el('h2', {}, 'Measurements'),
    meas.length ? measTable(data, meas.map((m) => ({ m }))) : none('measurements'),
    el('h2', {}, 'Observables'),
    obs.length ? el('ul', {}, ...obs.map((o) => el('li', {}, link(o.id, o.name), ` · ${o.kind}`,
      ` · theory ${pctOr(sum[o.id]?.th_pct)}, best experiment ${pctOr(sum[o.id]?.exp_pct)}`))) : none('observables'),
  );
}
