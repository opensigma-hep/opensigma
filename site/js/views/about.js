import { el } from '../leaf.js';
import { statusBadge } from '../format.js';
import { REPO } from '../config.js';

const LADDER_TEXT = [
  ['agent-draft', 'extracted by an agent from the cited source and locator; not yet checked by anyone'],
  ['cross-checked', 'two independent agent reads agree; no human has checked this'],
  ['machine-verified', 'matches the HEPData record'],
  ['human-verified', 'checked against the source by the named GitHub user'],
  ['disputed', 'flagged by a user; the value stays visible, shown in red with a link to the issue'],
];

const a = (href, text) => el('a', { href, textContent: text });

export function render(main) {
  main.replaceChildren(
    el('h1', {}, 'About OpenSigma'),
    el('p', {}, 'For each observable: what has been measured, what theory has achieved, and a referenced uncertainty budget. Every number carries its source, its locator in that source, and a verification status.'),
    el('h2', {}, 'Coverage rule'),
    el('h3', {}, 'Measurements'),
    el('ul', {},
      el('li', {}, 'Per channel, experiment and observable type: the most precise or most recent measurement.'),
      el('li', {}, 'Superseded measurements stay if they are still used in global fits; they are marked “superseded by”.'),
      el('li', {}, 'Combinations are their own measurement (experiment “combination”).'),
      el('li', {}, 'Preliminary results only when there is no paper; they are marked “preliminary”.')),
    el('h3', {}, 'Predictions'),
    el('ul', {},
      el('li', {}, 'Per observable: the highest accuracy along each axis (QCD, EW, mixed QCD×EW, resummation, parton-shower matching), plus any prediction the experiment compared to.'),
      el('li', {}, 'Intermediate steps only if they introduced a new building block.')),
    el('h3', {}, 'Completeness'),
    el('p', {}, 'Each channel states its coverage (complete, partial or stub) and the date it was last reviewed. Partial cells are drawn with a distinct texture; channels not reviewed for 18 months are marked as possibly outdated.'),
    el('h2', {}, 'Verification status'),
    el('dl', { className: 'facts ladder' }, ...LADDER_TEXT.flatMap(([s, text]) => {
      const b = statusBadge(s);
      return [el('dt', {}, el('span', { className: b.cls }, b.label)), el('dd', {}, text)];
    })),
    el('h2', {}, 'How to verify or flag a number'),
    el('p', {}, 'Next to every number are ✓ (verify) and ⚑ (flag) links. Each opens a prefilled GitHub issue with the value, its ID, its locator, a link to the source and the page you were on. Check the value against the source, then submit the issue; a GitHub Action turns it into a status-only change (no value is edited).'),
    el('ul', {},
      el('li', {}, 'One verification makes a value human-verified; the badge shows who verified it.'),
      el('li', {}, 'One flag makes it disputed: shown in red with a link to the issue, while the value stays visible.'),
      el('li', {}, 'Your GitHub account must be at least 6 months old.')),
    el('h2', {}, 'Licences'),
    el('ul', {},
      el('li', {}, 'Code: MIT (', a(`${REPO}/blob/main/LICENSE`, 'LICENSE'), ').'),
      el('li', {}, 'Data: CC BY 4.0 (', a(`${REPO}/blob/main/data/LICENSE`, 'data/LICENSE'), '). Please cite the original papers; each page has a copy-BibTeX button.')),
    el('p', {}, 'Source and issues: ', a(REPO, REPO)),
  );
}
