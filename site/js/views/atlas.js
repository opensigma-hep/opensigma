import { el, fill, link } from '../leaf.js';
import { diagramSvg } from '../feynman.js';

/** Process atlas: every process as a card with its leading-order diagram, grouped by (primary) family. */
export function render(main, data) {
  const fams = [...data.families].sort((a, b) => a.order - b.order);
  const card = (p) => {
    const d = data.diagrams?.[p.id];
    return el('li', {}, el('a', { className: 'atlas-card', href: '#/' + p.id },
      d ? el('div', { className: 'feyn', innerHTML: diagramSvg(data, p.id) }) : el('div', { className: 'feyn none-yet' }, 'No diagram yet'),
      el('strong', {}, p.name), d ? el('span', {}, d.title) : null));
  };
  fill(main,
    el('h1', {}, 'Process atlas'),
    el('p', {}, 'Every process with one representative leading-order Feynman diagram. Time runs left to right; straight lines are fermions, wavy lines photons and W/Z bosons, coils gluons, dashed lines the Higgs. Select a card to open the process.'),
    fams.flatMap((f) => {
      const procs = data.processes.filter((p) => p.family === f.id);
      return procs.length ? [el('h2', {}, link(f.id, f.name)), el('ul', { className: 'atlas' }, ...procs.map(card))] : [];
    }),
  );
}
