import { el, fill, none, link, idLink, index, facts, sep, ext } from '../leaf.js';
import { experimentsAt } from '../experiments.js';

// Every channel at one collider, grouped by family: "what is known at LHC 13 TeV?".
export function render(main, data, route) {
  const col = index(data).get(route.id).node;
  const cells = data.derived.cells;
  const exps = experimentsAt(data.experiments, col.id);
  const sqrts = [col.sqrts_gev].flat().map((g) => (g >= 1000 ? `${g / 1000} TeV` : `${g} GeV`)).join('–');
  const byFam = new Map(data.families.map((f) => [f.id, []]));
  for (const p of data.processes) for (const c of p.channels) if (c.collider === col.id) byFam.get(p.family).push([p, c]);
  const head = ['Process', 'Highest QCD order', 'Measurements', 'Observables', 'Coverage', 'Candidates'];
  const groups = [...byFam].filter(([, l]) => l.length).map(([fid, l]) => [el('h2', {}, idLink(data, fid)),
    el('div', { className: 'table-scroll' }, el('table', { className: 'meas' },
      el('thead', {}, el('tr', {}, ...head.map((h) => el('th', { scope: 'col' }, h)))),
      el('tbody', {}, ...l.map(([p, c]) => {
        const s = cells[c.id] ?? {};
        return el('tr', {}, el('th', { scope: 'row' }, link(c.id, p.name)), el('td', {}, s.max_qcd ?? '—'),
          el('td', {}, String(s.n_measurements ?? 0)), el('td', {}, String((c.observables ?? []).length)),
          el('td', {}, c.coverage + (s.stale ? ' (may be outdated)' : '')), el('td', {}, String(s.candidates ?? 0)));
      }))))]);
  fill(main,
    el('nav', { className: 'crumbs' }, link('', 'Families')),
    el('h1', {}, col.name),
    facts([['Beams', col.beams], ['√s', sqrts], ['Status', col.status],
      ['Machine', col.machine], ['Laboratory', col.lab], ['Years', col.years], ['Notes', col.note],
      ['Luminosity', col.luminosity ? [col.luminosity.text, ' (', ext(col.luminosity.source, 'source'), ')'] : null],
      ['Official page', col.url ? ext(col.url) : null],
      ['Other sources', col.sources?.length ? sep(col.sources.map((u) => ext(u))) : null],
      ['Experiments', exps.length ? sep(exps.map((e) => link(e.id, e.name))) : null]]),
    ...(groups.length ? groups.flat() : [none('channels at this collider')]),
  );
}
