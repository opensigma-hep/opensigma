import { el, none, link, idLink, index, refLink, prov, sep } from '../leaf.js';

export function render(main, data, route) {
  const par = index(data).get(route.id).node;
  const dets = par.determinations ?? [];
  const head = ['Value', 'Extracted from', 'Reference', 'Status'];
  main.replaceChildren(
    el('nav', { className: 'crumbs' }, link('', 'Families')),
    el('h1', {}, `${par.name} (${par.symbol})`),
    el('h2', {}, 'Determinations'),
    dets.length ? el('div', { className: 'table-scroll' }, el('table', { className: 'meas' },
      el('thead', {}, el('tr', {}, ...head.map((h) => el('th', { scope: 'col' }, h)))),
      el('tbody', {}, ...dets.map((d) => {
        const v = `${d.value} ± ${d.uncertainty}${par.unit ? ' ' + par.unit : ''}`;
        return el('tr', {}, el('td', {}, v), el('td', {}, ...sep((d.extracted_from ?? []).map((id) => idLink(data, id)))),
          el('td', {}, refLink(d.ref, data.refs)), el('td', {}, prov(d.provenance, v)));
      })))) : none('determinations'),
  );
}
