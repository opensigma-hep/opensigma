import { el, none, link, idLink, index, breadcrumb, facts, bbTable, prov, sep } from '../leaf.js';
import { accuracyChips } from '../format.js';

export function render(main, data, route) {
  const proc = index(data).get(route.id).node;
  const col = Object.fromEntries((data.colliders ?? []).map((c) => [c.id, c.name]));
  const chans = proc.channels ?? [];
  main.replaceChildren(
    breadcrumb(data, proc.id),
    el('h1', {}, proc.name),
    proc.description ? el('p', {}, proc.description) : null,
    facts([['Also in', proc.also_in?.length ? sep(proc.also_in.map((f) => idLink(data, f))) : null]]),
    el('h2', {}, 'Building blocks'),
    bbTable(proc, data),
    el('h2', {}, 'Channels'),
    chans.length ? el('ul', {}, ...chans.map((c) => el('li', {}, link(c.id, col[c.collider] ?? c.collider), ` · ${c.initial_state} · coverage ${c.coverage}`))) : none('channels'),
    el('h2', {}, 'Theory status'),
    el('p', { className: 'small' }, 'Predictions on the headline observable of each channel.'),
    ...(chans.length ? chans.map((c) => status(data, c, col)) : [none('channels')]),
  );
}

function status(data, chan, col) {
  const h = chan.headline && (chan.observables ?? []).find((o) => o.id === chan.headline.observable);
  const title = el('h3', {}, link(chan.id, col[chan.collider] ?? chan.collider), h ? [': ', link(h.id, h.name)] : null);
  if (!h) return el('div', {}, title, none('headline observable'));
  const preds = h.predictions ?? [];
  return el('div', {}, title, preds.length ? el('ul', {}, ...preds.map((p) => el('li', {},
    el('strong', {}, p.label), p.headline ? ' (headline)' : '', ' · ', accuracyChips(p.accuracy).join(', '),
    p.total ? [` · total ${p.total.value_pct} % `, prov(p.total.provenance, `${p.total.value_pct} %`)] : ''))) : none('predictions'));
}
