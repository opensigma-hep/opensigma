// Pure helpers for the experiment registry (data.experiments); measurements name their experiment by `name`.

/** name -> registry entry. */
export const expByName = (experiments) => new Map((experiments ?? []).map((e) => [e.name, e]));

/** Number of measurements per experiment name. */
export function measurementCounts(data) {
  const n = {};
  for (const p of data.processes ?? []) for (const c of p.channels ?? []) for (const m of c.measurements ?? []) n[m.experiment] = (n[m.experiment] ?? 0) + 1;
  return n;
}

/** Every measurement by one experiment: [{family, rows: [{proc, chan, m, observables}]}], families in display order;
 *  `observables` are the channel's observables with a result from that measurement. */
export function measurementsBy(data, name) {
  const groups = new Map([...(data.families ?? [])].sort((a, b) => a.order - b.order).map((f) => [f.id, { family: f, rows: [] }]));
  for (const proc of data.processes ?? []) {
    for (const chan of proc.channels ?? []) {
      for (const m of chan.measurements ?? []) {
        if (m.experiment !== name) continue;
        const observables = (chan.observables ?? []).filter((o) => (o.results ?? []).some((r) => r.measurement === m.id));
        groups.get(proc.family)?.rows.push({ proc, chan, m, observables });
      }
    }
  }
  return [...groups.values()].filter((g) => g.rows.length);
}

/** Experiments (kind "experiment" or "facility") registered at one collider. */
export const experimentsAt = (experiments, colId) =>
  (experiments ?? []).filter((e) => e.kind !== 'combination' && (e.colliders ?? []).includes(colId));
