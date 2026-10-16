import { search } from '../search.js';
import { el, link } from '../leaf.js';

export function render(main, data, { q }) {
  const input = el('input', { type: 'search', name: 'q', value: q, ariaLabel: 'Search query' });
  const form = el('form', { role: 'search' }, input, ' ', el('button', { type: 'submit' }, 'Search'));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value.trim();
    if (v) location.hash = '#/search?q=' + encodeURIComponent(v);
  });
  const hits = search(data.derived.search_index, q);
  let body;
  if (!q.trim()) body = el('p', { className: 'none-yet' }, 'Type a name, symbol (gamma, alphas, N3LL\'), or arXiv ID.');
  else if (!hits.length) body = el('p', { className: 'none-yet' }, 'No matches');
  else {
    body = el('ul', { className: 'search-results' },
      ...hits.map((h) => el('li', {}, link(h.id, h.label), ' ', el('small', {}, h.kind))));
    body.addEventListener('keydown', (e) => {
      const links = [...body.querySelectorAll('a')];
      const i = links.indexOf(document.activeElement);
      const d = { ArrowDown: 1, ArrowUp: -1 }[e.key];
      if (!d || i < 0) return;
      e.preventDefault();
      if (i + d < 0) input.focus(); else links[Math.min(i + d, links.length - 1)].focus();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); body.querySelector('a').focus(); }
    });
  }
  main.replaceChildren(el('h1', {}, 'Search'), form, body);
}
