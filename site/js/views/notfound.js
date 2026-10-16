export function render(el, data, route) {
  el.replaceChildren();
  const h = document.createElement('h1');
  h.textContent = 'Not found';
  const p = document.createElement('p');
  p.append('No page for ');
  const code = document.createElement('code');
  code.textContent = route.id ?? location.hash;
  p.append(code, '. ');
  const a = document.createElement('a');
  a.href = '#/';
  a.textContent = 'Back to all families';
  p.append(a);
  el.append(h, p);
}
