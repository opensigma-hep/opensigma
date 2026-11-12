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

/**
 * When a process reached a QCD order, read off the building-block row of exactly that order ("NNLO QCD"):
 * - the row has a `code` cell (combined calculation / public code): reached iff that cell is done, in the year of its earliest reference;
 * - an NLO row without one: reached iff every recorded cell is done, in the year the last of them appeared
 *   (latest over cells of the cell's earliest reference). Beyond NLO, loop amplitudes alone are not a cross section.
 * Returns {year, ref} or null.
 */
function rowReached(row, level, refs) {
  const first = (cell) => (cell.refs ?? []).map((ref) => ({ year: refs[ref.split(', ')[0]]?.year, ref }))
    .filter((x) => x.year != null).reduce((a, b) => (a && a.year <= b.year ? a : b), null);
  const cells = row.cells ?? {};
  if (cells.code) return cells.code.status === 'done' ? first(cells.code) : null;
  const all = Object.values(cells);
  if (level !== 'NLO' || !all.length || all.some((c) => c.status !== 'done')) return null;
  const firsts = all.map(first);
  return firsts.includes(null) ? null : firsts.reduce((a, b) => (a.year >= b.year ? a : b));
}

/**
 * Milestones: the year each process reached NLO / NNLO / N3LO QCD, from its own building-block row of that order (rowReached).
 * Series: per year, how many processes had reached that order or a higher one (so a process with no NLO row counts from its NNLO year).
 */
export function orderTimeline(data, until = new Date().getFullYear()) {
  const levels = ORDERS.slice(1, 4); // NLO, NNLO, N3LO
  const milestones = [];
  const reached = data.processes.map((proc) => { // per process: {level: year}
    const r = {};
    for (const level of levels) {
      const row = (proc.building_blocks ?? []).find((b) => b.row === `${level} QCD`);
      const hit = row && rowReached(row, level, data.refs);
      if (!hit) continue;
      milestones.push({ proc, level, ...hit });
      for (const lv of levels.slice(0, levels.indexOf(level) + 1)) if (!(r[lv] <= hit.year)) r[lv] = hit.year;
    }
    return r;
  });
  const total = reached.length;
  if (!milestones.length) return { years: [], series: {}, milestones: [], total };
  const years = [];
  for (let y = Math.min(...milestones.map((m) => m.year)); y <= until; y++) years.push(y);
  const series = Object.fromEntries(levels.map((lv) => [lv, years.map((y) => reached.filter((r) => r[lv] <= y).length)]));
  return { years, series, milestones: milestones.sort((a, b) => a.year - b.year), total };
}
