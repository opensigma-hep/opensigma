import { el, fill, none, link, idLink, evalChip } from '../leaf.js';

const table = (head, rows) => el('div', { className: 'table-scroll' }, el('table', { className: 'meas' },
  el('thead', {}, el('tr', {}, ...head.map((h) => el('th', { scope: 'col' }, h)))), el('tbody', {}, ...rows)));

/** The shared loop-amplitude library, by loop count. */
export function amplitudes(main, data) {
  const users = data.derived.amp_users ?? {};
  const amps = [...(data.amplitudes ?? [])].sort((a, b) => a.loops - b.loops || a.id.localeCompare(b.id));
  fill(main,
    el('h1', {}, 'Amplitude library'),
    el('p', {}, 'Partonic loop amplitudes, shared between processes. Each entry links to the building-block cells and predictions that use it.'),
    amps.length ? table(['Amplitude', 'Loops', 'Corrections', 'Process', 'Status', 'Evaluation', 'Used by'], amps.map((a) => el('tr', {},
      el('th', { scope: 'row' }, link(a.id)), el('td', {}, String(a.loops)), el('td', {}, a.corrections ?? ''),
      el('td', {}, idLink(data, a.process)), el('td', {}, a.status ?? ''),
      el('td', {}, evalChip(a.evaluation), a.evaluation?.detail ? el('div', { className: 'small' }, a.evaluation.detail) : null),
      el('td', {}, String((users[a.id] ?? []).length))))) : none('amplitudes'),
  );
}

/** SM parameters with their determinations. */
export function parameters(main, data) {
  const pars = data.parameters ?? [];
  fill(main,
    el('h1', {}, 'Parameters'),
    el('p', {}, 'Standard Model parameters and the measurements they are determined from.'),
    pars.length ? table(['Parameter', 'Symbol', 'Determinations'], pars.map((p) => el('tr', {},
      el('th', { scope: 'row' }, link(p.id, p.name)), el('td', {}, p.symbol), el('td', {}, String((p.determinations ?? []).length))))) : none('parameters'),
  );
}
