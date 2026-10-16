// Hash routing: "#/<id>", "#/about", "#/search?q=…", "" or "#/" for the home view.
const VIEW_BY_PREFIX = {
  fam: 'family', proc: 'process', chan: 'channel', obs: 'observable',
  amp: 'amplitude', par: 'parameter', meas: 'measurement', col: 'collider',
};

export const toHash = (id) => '#/' + id;

function decode(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

export function parseHash(hash, aliases, ids) {
  const path = hash.replace(/^#\/?/, '');
  if (path === '') return { view: 'families' };
  if (path === 'about') return { view: 'about' };
  if (path === 'search' || path.startsWith('search?')) {
    // Not URLSearchParams: it would turn a literal '+' into a space.
    const raw = path.slice(7).split('&').find((kv) => kv.startsWith('q='));
    return { view: 'search', q: raw ? decode(raw.slice(2)) : '' };
  }
  const raw = decode(path);
  const target = Object.hasOwn(aliases, raw) ? aliases[raw] : raw;
  const view = VIEW_BY_PREFIX[target.split(':', 1)[0]];
  if (!view || !ids.has(target)) return { view: 'notfound', id: raw };
  return target === raw ? { view, id: target } : { view, id: target, redirected: true };
}
