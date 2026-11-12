import { el, fill } from '../leaf.js';
import { GLOSSARY, lookup, glossaryHash } from '../glossary.js';
import { reveal } from '../charts.js';

/** #/glossary, or #/glossary?t=<term> to jump to one entry. */
export function render(main, data, { t }) {
  const groups = [...new Set(GLOSSARY.map((e) => e.group))];
  const dts = new Map();
  fill(main,
    el('h1', {}, 'Glossary'),
    el('p', {}, 'Every abbreviation, label and status shown on this site. Dotted-underlined labels elsewhere on the site link to their entry here and show the first sentence on hover or keyboard focus.'),
    groups.flatMap((g) => [
      el('h2', {}, g),
      el('dl', { className: 'glossary' }, ...GLOSSARY.filter((e) => e.group === g).flatMap((e) => {
        const dt = el('dt', { id: 'g-' + e.id }, el('a', { href: glossaryHash(e.id) }, e.term));
        dts.set(e.id, dt);
        return [dt, el('dd', {}, e.long)];
      })),
    ]));
  const hit = t && dts.get(lookup(t)?.id);
  // After the router's scroll-to-top (a timer, not rAF: rAF never fires in a background tab).
  if (hit) setTimeout(() => { hit.scrollIntoView({ block: 'center' }); reveal(hit); }, 0);
}
