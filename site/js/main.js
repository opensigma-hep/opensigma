import { parseHash, toHash } from './router.js';
import * as families from './views/families.js';
import * as notfound from './views/notfound.js';
import * as placeholder from './views/placeholder.js';

// Later tasks replace the placeholder entries.
const views = {
  families, notfound,
  family: placeholder, process: placeholder, channel: placeholder, observable: placeholder,
  amplitude: placeholder, parameter: placeholder, about: placeholder, search: placeholder,
  measurement: placeholder, collider: placeholder,
};

const THEME_KEY = 'pheno-map-theme';
const root = document.documentElement;
const main = document.getElementById('main');
const toggle = document.getElementById('theme-toggle');

function savedTheme() {
  try { return localStorage.getItem(THEME_KEY); } catch { return null; }
}
function isDark() {
  const t = root.dataset.theme;
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
}
function syncToggle() {
  toggle.setAttribute('aria-pressed', String(isDark()));
}

const saved = savedTheme();
if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;
syncToggle();
toggle.addEventListener('click', () => {
  const next = isDark() ? 'light' : 'dark';
  root.dataset.theme = next;
  try { localStorage.setItem(THEME_KEY, next); } catch { /* private mode: theme just won't persist */ }
  syncToggle();
});

document.getElementById('search-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = new FormData(e.target).get('q').trim();
  if (q) location.hash = '#/search?q=' + encodeURIComponent(q);
});

// Every id-bearing node: families, processes, channels, measurements, observables, amplitudes, parameters, colliders.
function collectIds(d) {
  const ids = new Set();
  const add = (n) => n.id && ids.add(n.id);
  [d.families, d.amplitudes, d.parameters, d.colliders].forEach((l) => (l ?? []).forEach(add));
  for (const p of d.processes ?? []) {
    add(p);
    for (const c of p.channels ?? []) {
      add(c);
      [...(c.measurements ?? []), ...(c.observables ?? [])].forEach(add);
    }
  }
  return ids;
}

function fail(msg) {
  main.textContent = msg;
}

let first = true;
function route() {
  const { data, idset } = window.PM;
  const r = parseHash(location.hash, data.derived.aliases, idset);
  if (r.redirected) history.replaceState(null, '', toHash(r.id));
  views[r.view].render(main, data, r);
  document.title = (r.id ?? r.q ?? r.view) + ' · pheno-map';
  if (r.view === 'families') document.title = 'pheno-map';
  if (!first) main.focus({ preventScroll: true });
  first = false;
  window.scrollTo(0, 0);
}

try {
  const resp = await fetch('./data.json');
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  window.PM = { data, idset: collectIds(data) };
  document.getElementById('build-info').textContent =
    `Built ${data.build.date} · ${data.build.git_sha}`;
  addEventListener('hashchange', route);
  route();
} catch (err) {
  fail(`Could not load data.json (${err.message}).`);
}
