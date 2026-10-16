import { toHash } from '../router.js';

export function render(el, data) {
  el.replaceChildren();
  const h = document.createElement('h1');
  h.textContent = 'Families';
  const grid = document.createElement('div');
  grid.className = 'tiles';
  const stats = data.derived.family_stats;
  for (const f of [...data.families].sort((a, b) => a.order - b.order)) {
    const s = stats[f.id] ?? { n_processes: 0, n_channels: 0, frac_nnlo_plus: 0 };
    const pct = Math.round(s.frac_nnlo_plus * 100);
    const a = document.createElement('a');
    a.className = 'tile';
    a.href = toHash(f.id);
    a.setAttribute('aria-label',
      `${f.name}: ${s.n_processes} processes, ${s.n_channels} channels, ${pct}% of channels at NNLO or higher`);
    const name = document.createElement('strong');
    name.textContent = f.name;
    const meta = document.createElement('span');
    meta.textContent = `${s.n_processes} processes · ${s.n_channels} channels · ${pct}% ≥ NNLO`;
    a.append(name, meta);
    grid.append(a);
  }
  el.append(h, grid);
}
