// Stand-in for views that later tasks implement; main.js's view table points here until then.
export function render(el, data, route) {
  el.replaceChildren();
  const h = document.createElement('h1');
  h.textContent = route.id ?? route.q ?? route.view;
  const p = document.createElement('p');
  p.append(`The “${route.view}” view is not built yet. `);
  const a = document.createElement('a');
  a.href = '#/';
  a.textContent = 'Back to all families';
  p.append(a);
  el.append(h, p);
}
