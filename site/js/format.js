// Pure display helpers: no DOM, no D3.
import { LADDER } from './matrix.js';

const NUM = String.raw`\d+(?:\.\d+)?`;
const SYM = new RegExp(`^±(${NUM})$`);
const ASYM = new RegExp(`^\\+(${NUM})/[-−](${NUM})$`);

/** "±0.4" | "+3.1/−5.0" | "+3.1/-5.0" -> {up, down}; anything else throws. */
export function parseRegionValue(s) {
  let m = SYM.exec(s);
  if (m) return { up: +m[1], down: -m[1] };
  m = ASYM.exec(s);
  if (m) return { up: +m[1], down: -m[2] };
  throw new Error(`not a region value: ${JSON.stringify(s)}`);
}

const prime = (s) => s.replaceAll("'", '′');

export function accuracyChips(a) {
  const chips = a.qcd ? [`${a.qcd} QCD`] : [];
  // EW first when it is the defining accuracy (QCD only LO), e.g. e+e− → WW at NLO EW.
  if (a.ew) chips[a.ew !== 'LO' && (a.qcd ?? 'LO') === 'LO' ? 'unshift' : 'push'](`${a.ew} EW`);
  if (a.mixed) chips.push(a.mixed);
  for (const r of a.resummation ?? []) chips.push(`${r.accuracy} ${r.variable}`);
  if (a.shower_matched) chips.push('+PS');
  chips.push(...(a.approximations ?? []));
  return chips.map(prime);
}

export function statusBadge(status) {
  return LADDER.includes(status) ? { label: status, cls: 'badge st-' + status } : { label: status ?? 'unknown', cls: 'badge st-unknown' };
}

// At least one decimal, otherwise as many as the data has: 6 -> "6.0", 0.01 -> "0.01"; exponent form is kept (1e-7).
const num = (x) => (String(x).includes('e') ? String(x) : x.toFixed(Math.max(1, (String(x).split('.')[1] ?? '').length)));

export function fmtSize(size) {
  const [a, b] = size.range;
  return `${a === b ? num(a) : `${num(a)}–${num(b)}`} ${size.unit ?? '%'}`;
}

/** Target total as a bar length: only a plain number (optional leading ≤/<, optional %); ranges and prose give null. */
export function parseTargetPct(s) {
  const m = /^[≤<]?\s*(\d+(?:\.\d+)?)\s*%?$/.exec(s ?? '');
  return m ? +m[1] : null;
}

/** Link text for a ref record: "Authors (year)", dropping what is missing (title, then the key, stand in for authors). */
export function refText(key, r) {
  const who = r.authors_short ?? (r.title ? (r.title.length > 60 ? r.title.slice(0, 59) + '…' : r.title) : key);
  return r.year != null ? `${who} (${r.year})` : who;
}
