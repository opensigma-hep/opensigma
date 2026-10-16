// Pure search over derived.search_index; typed-ASCII physics notation matches the Unicode labels.
const GREEK = { α: 'alpha', β: 'beta', γ: 'gamma', δ: 'delta', ε: 'epsilon', θ: 'theta', λ: 'lambda',
  μ: 'mu', ν: 'nu', π: 'pi', ρ: 'rho', σ: 'sigma', τ: 'tau', φ: 'phi', χ: 'chi', ψ: 'psi', ω: 'omega', ℓ: 'l' };
const KIND_ORDER = ['fam', 'proc', 'chan', 'obs', 'amp', 'par', 'meas'];

export function normalize(s) {
  return s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/′/g, "'").replace(/−/g, '-').replace(/√/g, 'sqrt')
    .replace(/[α-ωℓ]/g, (c) => GREEK[c] ?? c)
    .replace(/\s*_\s*/g, '')            // alpha_s -> alphas
    .replace(/(?<=[a-z])\s+(?=[a-z])/g, ''); // "alpha s" -> alphas
}

export function search(index, q, limit = 20) {
  const toks = q.split(/\s+/).filter(Boolean).map(normalize);
  if (!toks.length) return [];
  const hits = [];
  for (const e of index) {
    const label = normalize(e.label);
    const tier = label.startsWith(toks[0]) && toks.every((t) => label.includes(t)) ? 0
      : toks.every((t) => label.includes(t)) ? 1
      : toks.every((t) => (label + ' ' + normalize(e.text)).includes(t)) ? 2 : -1;
    if (tier >= 0) hits.push([tier, KIND_ORDER.indexOf(e.kind), e]);
  }
  // Array.sort is stable, so ties keep index order.
  return hits.sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, limit).map((h) => h[2]);
}
