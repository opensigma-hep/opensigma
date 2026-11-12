import { el, fill, none, link, idLink, index, facts, refLink, sep, ext, linkList } from '../leaf.js';
import { measurementsBy, measurementCounts } from '../experiments.js';

const table = (head, rows) => el('div', { className: 'table-scroll' }, el('table', { className: 'meas' },
  el('thead', {}, el('tr', {}, ...head.map((h) => el('th', { scope: 'col' }, h)))), el('tbody', {}, ...rows)));
const colLinks = (data, e) => (e.colliders?.length ? sep(e.colliders.map((c) => idLink(data, c))) : null);
const when = (e) => [e.years, e.status].filter(Boolean).join(' · ');

/** One experiment: what it is, its official links, and every measurement by it, by family. */
export function render(main, data, route) {
  const e = index(data).get(route.id).node;
  const groups = measurementsBy(data, e.name);
  const total = groups.reduce((n, g) => n + g.rows.length, 0);
  const crumbs = el('nav', { className: 'crumbs' }, link('', 'Families'), ' › ', link('experiments', 'Experiments'));
  crumbs.setAttribute('aria-label', 'Breadcrumb');
  fill(main,
    crumbs,
    el('h1', {}, e.name === 'combination' ? 'Combinations' : e.name),
    e.full_name ? el('p', { className: 'small' }, e.full_name) : null,
    el('p', {}, e.description),
    facts([['Colliders', colLinks(data, e)], ['Operation', when(e)]]),
    e.links?.length ? [el('h2', {}, 'Official pages'), linkList(e.links)] : null,
    e.kind === 'combination' ? el('p', {}, 'Working groups and combination pages are on the ', link('experiments', 'experiments index'), '.') : null,
    e.sources?.length ? el('p', { className: 'small' }, 'Description and dates also from: ', ...sep(e.sources.map((u) => ext(u)))) : null,
    el('h2', {}, `Measurements (${total})`),
    ...(groups.length ? groups.flatMap((g) => [el('h3', {}, idLink(data, g.family.id)),
      table(['Process and collider', 'Dataset', 'Paper', 'Observables', 'Notes'], g.rows.map(({ chan, m, observables }) => el('tr', {},
        el('th', { scope: 'row' }, idLink(data, chan.id)),
        el('td', {}, m.dataset ?? ''),
        el('td', {}, refLink(m.ref, data.refs)),
        el('td', {}, ...(observables.length ? sep(observables.map((o) => link(o.id, o.name)), '; ') : ['—'])),
        el('td', {}, [m.projected && 'projected', m.preliminary && 'preliminary', m.superseded_by && 'superseded'].filter(Boolean).join(', ')))))]) : [none('measurements')]),
  );
}

/** #/experiments: the registry, then the working groups and combination pages. */
export function list(main, data) {
  const n = measurementCounts(data);
  const exps = data.experiments ?? [], groups = data.groups ?? [];
  fill(main,
    el('h1', {}, 'Experiments'),
    el('p', {}, 'Who measured what. Each experiment page lists its official pages (website, public results, HEPData, INSPIRE) and every measurement in OpenSigma by that experiment.'),
    exps.length ? table(['Experiment', 'Colliders', 'Operation', 'Measurements', 'Website'], exps.map((e) => el('tr', {},
      el('th', { scope: 'row' }, link(e.id, e.name), e.full_name ? el('div', { className: 'small' }, e.full_name) : null),
      el('td', {}, ...(colLinks(data, e) ?? ['—'])), el('td', {}, when(e) || '—'), el('td', {}, String(n[e.name] ?? 0)),
      el('td', {}, e.links?.length ? ext(e.links[0].url, e.links[0].label) : '—')))) : none('experiments'),
    el('h2', {}, 'Working groups and combinations'),
    el('p', { className: 'small' }, 'Groups that combine results across experiments or publish reference cross sections and world averages. Combined results in OpenSigma are listed under ',
      index(data).has('exp:combination') ? link('exp:combination', 'combinations') : 'the experiment “combination”', '.'),
    groups.length ? el('dl', { className: 'groups' }, ...groups.flatMap((g) => [
      el('dt', { id: g.id }, g.name, g.full_name ? ` (${g.full_name})` : ''),
      el('dd', {}, g.description, linkList(g.links))])) : none('working groups'),
  );
}
