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

/** @misc BibTeX for the version DOI and the concept DOI of a release ({version, doi, concept_doi}); '' when unreleased. */
export function releaseBibtex(rel, year) {
  if (!rel) return '';
  const entry = (key, doi, extra = '') => `@misc{${key},
  title = {pheno-map: a map of collider phenomenology},
  author = {{pheno-map contributors}},
  year = {${year}},${extra}
  doi = {${doi}},
  url = {https://doi.org/${doi}},
}`;
  return [
    entry(`pheno-map-${rel.version}`, rel.doi, `\n  version = {${rel.version}},`),
    entry('pheno-map-concept', rel.concept_doi),
  ].join('\n\n');
}
