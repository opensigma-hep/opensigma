import { parseHash, toHash } from './router.js';
import * as families from './views/families.js';
import * as family from './views/family.js';
import * as notfound from './views/notfound.js';
import * as collider from './views/collider.js';
import * as lists from './views/lists.js';
import * as observable from './views/observable.js';
import * as channel from './views/channel.js';
import * as process from './views/process.js';
import * as amplitude from './views/amplitude.js';
import * as parameter from './views/parameter.js';
import * as about from './views/about.js';
import * as search from './views/search.js';
import { copyButton, label } from './leaf.js';
import { releaseBibtex } from './bibtex.js';

const views = {
  families, notfound,
  family, process, channel, observable, amplitude, parameter, about,
  search, collider, amplitudes: { render: lists.amplitudes }, parameters: { render: lists.parameters },
};

const THEME_KEY = 'opensigma-theme';
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

function renderFooter({ date, git_sha, release }) {
  const info = document.getElementById('build-info');
  info.replaceChildren(`Built ${date}${git_sha ? ` · ${git_sha}` : ''} · `);
  if (release) info.append(release.version, ' ', copyButton('Cite this version', () => releaseBibtex(release, date.slice(0, 4))));
  else info.append('unreleased');
  info.append(' · Data CC BY 4.0 · Code MIT');
}

function fail(msg) {
  main.textContent = msg;
}

let first = true;
function route() {
  const { data, idset } = window.PM;
  const r = parseHash(location.hash, data.derived.aliases, idset, data.derived.parents);
  if (r.redirected) history.replaceState(null, '', toHash(r.id));
  views[r.view].render(main, data, r);
  document.title = (r.id ? label(data, r.id) : r.q ?? r.view) + ' · OpenSigma';
  for (const a of document.querySelectorAll('header nav a')) a.toggleAttribute('aria-current', a.hash === '#/' + r.view);
  if (r.view === 'families') document.title = 'OpenSigma';
  if (!first) main.focus({ preventScroll: true });
  first = false;
  window.scrollTo(0, 0);
}

try {
  const resp = await fetch('./data.json');
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  window.PM = { data, idset: collectIds(data) };
  renderFooter(data.build);
  addEventListener('hashchange', route);
  route();
} catch (err) {
  fail(`Could not load data.json (${err.message}).`);
}
