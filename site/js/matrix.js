// Pure helpers for the family matrix: no DOM, no D3.
export const ORDERS = ['LO', 'NLO', 'NNLO', 'N3LO', 'N4LO'];
export const LADDER = ['disputed', 'agent-draft', 'cross-checked', 'machine-verified', 'human-verified'];

/** Colliders that have at least one channel of a family process, sorted by `order`. */
export function columnsFor(familyProcesses, cells, colliders) {
  const procs = new Set(familyProcesses);
  const used = new Set(Object.values(cells).filter((c) => procs.has(c.process)).map((c) => c.collider));
  return colliders.filter((c) => used.has(c.id)).sort((a, b) => a.order - b.order);
}

// Ratio < 1: theory more precise than experiment; > 1: theory is the bottleneck.
const RATIO_EDGES = [0.5, 0.8, 1.25, 2];
export const RATIO_LABELS = ['< 0.5', '0.5 – 0.8', '0.8 – 1.25', '1.25 – 2', '> 2'];
export const ratioBin = (r) => RATIO_EDGES.findIndex((e) => r <= e) < 0 ? 4 : RATIO_EDGES.findIndex((e) => r <= e);

/** Fill (precision ratio), texture and text label for one cell. A missing cell means the process has no channel at that collider. */
export function cellState(cell, includeProj) {
  if (!cell) return { fill: 'none', pattern: 'none', label: 'no channel' };
  const ratio = includeProj ? cell.ratio_with_projections : cell.ratio;
  const n = cell.n_measurements;
  const parts = [cell.max_qcd == null ? 'no QCD prediction' : `${cell.max_qcd} QCD`,
    ratio == null ? 'no precision ratio' : `precision ratio ${+ratio.toFixed(2)} (theory/experiment)`,
    `${n} measurement${n === 1 ? '' : 's'}`];
  if (cell.candidates > 0) parts.push(`${cell.candidates} candidate${cell.candidates === 1 ? '' : 's'}`);
  if (cell.coverage === 'partial') parts.push('partial coverage');
  if (cell.stale) parts.push('may be outdated');
  const label = parts.join(', ');
  if (ratio == null) return { fill: 'var(--cell-empty)', pattern: 'hatch', label };
  return { fill: `var(--rat-${ratioBin(ratio) + 1})`, pattern: cell.coverage === 'partial' ? 'partial' : 'none', label };
}

/** Cell filters. null min_status / max_qcd pass only when the filter is "any". */
export function passes(cell, f) {
  if (f.minOrder !== 'any' && (cell.max_qcd == null || ORDERS.indexOf(cell.max_qcd) < ORDERS.indexOf(f.minOrder))) return false;
  if (f.minStatus !== 'any' && (cell.min_status == null || LADDER.indexOf(cell.min_status) < LADDER.indexOf(f.minStatus))) return false;
  return !(f.hasTarget && !cell.has_target);
}
