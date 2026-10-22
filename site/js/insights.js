// Catalogue-wide views: gap finder, next-run ranking, theory-progress timeline. Pure: no DOM, no D3.
import { ORDERS } from './matrix.js';

/** Processes with partial/missing building blocks, worst theory÷experiment ratio first (unknown ratio last, then most gaps). */
export function gaps(data) {
  const worst = {};
  for (const [chan, c] of Object.entries(data.derived.cells)) {
    if (c.ratio != null && !(worst[c.process]?.ratio >= c.ratio)) worst[c.process] = { ratio: c.ratio, chan };
  }
  return data.processes
    .map((proc) => ({
      proc, worst: worst[proc.id] ?? null,
      open: (proc.building_blocks ?? []).flatMap((r) => Object.entries(r.cells ?? {})
        .filter(([, x]) => x.status !== 'done')
        .map(([col, x]) => ({ row: r.row, col, status: x.status, approximations: x.approximations ?? [] }))),
    }))
    .filter((g) => g.open.length)
    .sort((a, b) => (b.worst?.ratio ?? -1) - (a.worst?.ratio ?? -1) || b.open.length - a.open.length);
}

/**
 * Observables with a projected measurement: best projected total vs the current headline theory total of the SAME observable.
 * ratio > 1: theory must improve before that data arrives. No theory number on the observable -> ratio null (listed last).
 */
export function nextRun(data) {
  const sum = data.derived.observable_summary ?? {};
  const rows = [];
  for (const proc of data.processes) for (const chan of proc.channels) {
    const meas = Object.fromEntries((chan.measurements ?? []).map((m) => [m.id, m]));
    for (const obs of chan.observables ?? []) {
      const proj = (obs.results ?? []).filter((r) => meas[r.measurement]?.projected && r.total?.value_pct > 0);
      if (!proj.length) continue;
      const best = proj.reduce((a, b) => (b.total.value_pct < a.total.value_pct ? b : a));
      const th = sum[obs.id]?.th_pct ?? null;
      rows.push({ proc, chan, obs, measurement: meas[best.measurement], proj: best.total.value_pct, th,
        ratio: th != null ? th / best.total.value_pct : null, target: obs.theory_target ?? null });
    }
  }
  return rows.sort((a, b) => (b.ratio ?? -Infinity) - (a.ratio ?? -Infinity));
}

/** Earliest cited year of a prediction (the calculation usually predates the comparison paper that also cites it). */
function predYear(p, refs) {
  const ys = [...(p.refs ?? []), p.total?.provenance?.ref].filter(Boolean)
    .map((r) => refs[r.split(', ')[0]]?.year).filter((y) => y != null);
  return ys.length ? Math.min(...ys) : null;
}

/**
 * For each QCD order from NLO up: how many channels had a prediction at that order or higher, per year.
 * Milestones: the first year each process reached each order, with the observable that shows it.
 */
export function orderTimeline(data, until = new Date().getFullYear()) {
  const levels = ORDERS.slice(1, 4); // NLO, NNLO, N3LO
  const reached = []; // per channel: {level: year}
  const milestones = new Map(); // `${proc}|${level}` -> {proc, level, year, obs, label}
  for (const proc of data.processes) for (const chan of proc.channels) {
    const r = {};
    for (const obs of chan.observables ?? []) for (const p of obs.predictions ?? []) {
      const year = predYear(p, data.refs);
      if (year == null) continue;
      for (const lv of levels) {
        if (ORDERS.indexOf(p.accuracy.qcd) < ORDERS.indexOf(lv)) continue;
        if (!(r[lv] <= year)) r[lv] = year;
        const k = `${proc.id}|${lv}`;
        if (!(milestones.get(k)?.year <= year)) milestones.set(k, { proc, level: lv, year, obs, label: p.label });
      }
    }
    reached.push(r);
  }
  const all = reached.flatMap((r) => Object.values(r));
  if (!all.length) return { years: [], series: {}, milestones: [] };
  const years = [];
  for (let y = Math.min(...all); y <= until; y++) years.push(y);
  const series = Object.fromEntries(levels.map((lv) => [lv, years.map((y) => reached.filter((r) => r[lv] <= y).length)]));
  return { years, series, milestones: [...milestones.values()].sort((a, b) => a.year - b.year), total: reached.length };
}
