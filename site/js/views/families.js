import { el, fill, link } from '../leaf.js';
import { ORDERS } from '../matrix.js';
import { scatterPoints, drawScatter } from '../scatter.js';

export function render(main, data) {
  const fams = [...data.families].sort((a, b) => a.order - b.order);
  const color = Object.fromEntries(fams.map((f, i) => [f.id, window.d3.schemeTableau10[i % 10]]));
  const cells = data.derived.cells, stats = data.derived.family_stats;
  const chans = data.processes.flatMap((p) => p.channels);
  const obs = chans.flatMap((c) => c.observables ?? []);
  const totals = [[data.processes.length, 'processes'], [chans.length, 'channels'], [obs.length, 'observables'],
    [chans.reduce((n, c) => n + (c.measurements ?? []).length, 0), 'measurements'],
    [obs.reduce((n, o) => n + (o.predictions ?? []).length, 0), 'predictions'],
    [data.amplitudes.length, 'amplitudes'], [Object.keys(data.refs).length, 'papers']];

  const tiles = el('div', { className: 'tiles' }, ...fams.map((f) => {
    const s = stats[f.id] ?? { n_processes: 0, n_channels: 0, frac_nnlo_plus: 0 };
    const procs = new Set(data.derived.family_processes[f.id] ?? []);
    const orders = Object.values(cells).filter((c) => procs.has(c.process)).map((c) => c.max_qcd);
    const bar = el('span', { className: 'ordbar', ariaHidden: 'true' }, ...[...ORDERS, null].map((o, i) => {
      const n = orders.filter((x) => x === o).length;
      const seg = el('span');
      seg.style.flexGrow = n;
      seg.style.background = o ? `var(--ord-${i + 1})` : 'var(--cell-empty)';
      return seg;
    }));
    const pct = Math.round(s.frac_nnlo_plus * 100);
    const a = el('a', { className: 'tile', href: '#/' + f.id },
      el('strong', {}, el('span', { className: 'swatch' }), ' ', f.name),
      el('span', {}, `${s.n_processes} processes · ${s.n_channels} channels · ${pct}% ≥ NNLO`), bar);
    a.querySelector('.swatch').style.background = color[f.id];
    a.setAttribute('aria-label', `${f.name}: ${s.n_processes} processes, ${s.n_channels} channels, ${pct}% of channels at NNLO or higher`);
    return a;
  }));

  const famOf = {}, nameOf = {};
  for (const p of data.processes) for (const c of p.channels) for (const o of c.observables ?? []) { famOf[o.id] = p.family; nameOf[o.id] = `${o.name} (${p.name}, ${data.colliders.find((x) => x.id === c.collider)?.name})`; }
  const plot = el('div', { className: 'scatter-wrap' });
  drawScatter(plot, scatterPoints(data.derived.observable_summary, false).map((p) => ({ ...p, name: nameOf[p.id] ?? p.id, color: color[famOf[p.id]] })));

  const usedCols = new Set(chans.map((c) => c.collider));
  fill(main,
    el('h1', {}, 'OpenSigma'),
    el('p', {}, 'For each collider observable: what has been measured, what theory has achieved, and a referenced uncertainty budget. Every number links to the page and table it comes from and carries a verification status.'),
    el('p', { className: 'small' }, totals.map(([n, w]) => `${n} ${w}`).join(' · ')),
    el('h2', {}, 'Families'),
    el('p', { className: 'small' }, 'A family opens a process × collider matrix. Each cell is a channel; a channel lists its observables; an observable shows measurements, predictions and the uncertainty budget. The bar under each family shows its channels by highest QCD order (grey: no prediction yet).'),
    tiles,
    el('h2', {}, 'Precision landscape'),
    el('p', { className: 'small' }, 'Every observable with both a headline prediction and a measurement: theory against experimental total uncertainty. Above the diagonal, theory is the bottleneck. Select a point to open the observable.'),
    el('div', { className: 'landscape' }, plot, el('ul', { className: 'fam-legend' }, ...fams.map((f) => {
      const sw = el('span', { className: 'swatch' });
      sw.style.background = color[f.id];
      return el('li', {}, sw, ' ', link(f.id, f.name));
    }))),
    el('h2', {}, 'Browse'),
    el('ul', {},
      el('li', {}, el('a', { href: '#/amplitudes' }, 'Amplitude library'), ' · loop amplitudes shared between processes'),
      el('li', {}, el('a', { href: '#/parameters' }, 'Parameters'), ` · ${data.parameters.map((x) => x.symbol).join(', ')} and their determinations`),
      el('li', {}, 'Colliders: ', ...data.colliders.filter((c) => usedCols.has(c.id)).flatMap((c, i) => [i ? ' · ' : '', link(c.id, c.name)]))),
  );
}
