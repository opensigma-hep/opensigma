import { el, fill, none, link, idLink, index, refLink, prov, sep } from '../leaf.js';
import { refText } from '../format.js';
import { drawIdeogram, reveal } from '../charts.js';

export function render(main, data, route) {
  const par = index(data).get(route.id).node;
  const dets = par.determinations ?? [];
  const head = ['Value', 'Extracted from', 'Reference', 'Status'];
  const plot = el('div', { className: 'ideogram-wrap' });
  const names = dets.map((d) => refText(d.ref, data.refs[d.ref] ?? {}));
  drawIdeogram(plot, dets, par.unit, names, (d) => reveal(main.querySelector(`tr[data-i="${d.i}"]`)));
  fill(main,
    el('nav', { className: 'crumbs' }, link('', 'Families'), ' › ', el('a', { href: '#/parameters' }, 'Parameters')),
    el('h1', {}, `${par.name} (${par.symbol})`),
    el('h2', {}, 'Determinations'),
    ...(dets.length > 1 ? [plot, el('p', { className: 'small' }, 'Value ± uncertainty as quoted by each source. Select a point to jump to its row, locator and status.')] : []),
    dets.length ? el('div', { className: 'table-scroll' }, el('table', { className: 'meas' },
      el('thead', {}, el('tr', {}, ...head.map((h) => el('th', { scope: 'col' }, h)))),
      el('tbody', {}, ...dets.map((d, i) => {
        // YAML drops trailing zeros (0.1180 → 0.118): show value and uncertainty to the same decimals.
        const dp = Math.max(...[d.value, d.uncertainty].map((x) => (String(x).split('.')[1] ?? '').length));
        const v = `${d.value.toFixed(dp)} ± ${d.uncertainty.toFixed(dp)}${par.unit ? ' ' + par.unit : ''}`;
        return el('tr', { dataset: { i: String(i) } }, el('td', {}, v), el('td', {}, ...sep((d.extracted_from ?? []).map((id) => idLink(data, id)))),
          el('td', {}, refLink(d.ref, data.refs), `, ${d.provenance.locator}`), el('td', {}, prov(d.provenance, v)));
      })))) : none('determinations'),
  );
}
