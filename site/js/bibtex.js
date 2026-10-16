// Pure: no DOM.
const REF = /^(inspire:\d+|arXiv:[^,\s]+|hepdata:ins(\d+)\/)/;

/** BibTeX of every distinct cited record under `node` (any string value that is a ref), in first-seen order. */
export function collectBibtex(node, refs) {
  const out = new Set();
  (function walk(v) {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === 'object') return Object.values(v).forEach(walk);
    const m = typeof v === 'string' && REF.exec(v);
    if (!m) return;
    const bib = refs[m[2] ? `inspire:${m[2]}` : m[1]]?.bibtex;
    if (bib) out.add(bib); // arXiv alias keys carry the same bibtex as their inspire record
  })(node);
  return [...out].join('\n');
}
