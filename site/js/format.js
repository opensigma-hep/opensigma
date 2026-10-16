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
  const chips = [`${a.qcd} QCD`];
  if (a.ew) chips.push(`${a.ew} EW`);
  if (a.mixed) chips.push(a.mixed);
  for (const r of a.resummation ?? []) chips.push(`${r.accuracy} ${r.variable}`);
  if (a.shower_matched) chips.push('+PS');
  chips.push(...(a.approximations ?? []));
  return chips.map(prime);
}

export function statusBadge(status) {
  return LADDER.includes(status) ? { label: status, cls: 'badge st-' + status } : { label: status ?? 'unknown', cls: 'badge st-unknown' };
}

// At least one decimal, otherwise as many as the data has: 6 -> "6.0", 0.01 -> "0.01".
const num = (x) => x.toFixed(Math.max(1, (String(x).split('.')[1] ?? '').length));

export function fmtSize(size) {
  const [a, b] = size.range;
  return `${a === b ? num(a) : `${num(a)}–${num(b)}`} ${size.unit ?? '%'}`;
}
