// Leading-order Feynman diagrams as inline SVG strings. Pure (no DOM); the spec format is documented in docs/diagrams.md.
export const EDGE_TYPES = ['fermion', 'antifermion', 'gluon', 'photon', 'boson', 'scalar', 'ghost'];
export const GRID = { x: 4, y: 3 };

const U = 60; // SVG units per grid step: a full-size diagram is ~330 units wide, drawn 1:1
const n2 = (v) => +v.toFixed(2);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * Path along a parametric curve t -> [u, v] (u along the edge, v across it) with derivative d(t), t in [0, t1]:
 * cubic Béziers whose control points come from the exact tangents (Hermite), so wiggles and coils are smooth.
 */
function curve(a, e, p, d, t1, segs) {
  const world = ([u, v]) => [a[0] + u * e[0] - v * e[1], a[1] + u * e[1] + v * e[0]];
  const vec = ([u, v]) => [u * e[0] - v * e[1], u * e[1] + v * e[0]];
  const h = t1 / segs;
  let P = world(p(0)), D = vec(d(0));
  let out = `M${n2(P[0])} ${n2(P[1])}`;
  for (let i = 1; i <= segs; i++) {
    const Q = world(p(i * h)), E = vec(d(i * h));
    out += `C${n2(P[0] + D[0] * h / 3)} ${n2(P[1] + D[1] * h / 3)} ${n2(Q[0] - E[0] * h / 3)} ${n2(Q[1] - E[1] * h / 3)} ${n2(Q[0])} ${n2(Q[1])}`;
    P = Q; D = E;
  }
  return out;
}

/** Sine wave with a whole number of periods fitted to the edge. */
function wavy(a, e, L, k) {
  const n = Math.max(1, Math.round(L / (15 * k))), A = 5 * k, s = L / (2 * Math.PI * n);
  return curve(a, e, (t) => [s * t, A * Math.sin(t)], (t) => [s, A * Math.cos(t)], 2 * Math.PI * n, 4 * n);
}

/** Coil (prolate trochoid): n + ½ turns, starting and ending on the edge axis, loops all on one side. */
function coil(a, e, L, k) {
  const r = 5.5 * k, A = 7 * k;
  const n = Math.max(1, Math.round((L - 2 * r) / (11 * k) - 0.5)), s = (L - 2 * r) / (2 * Math.PI * (n + 0.5));
  return curve(a, e, (t) => [s * t + r * (1 - Math.cos(t)), A * Math.sin(t)], (t) => [s + r * Math.sin(t), A * Math.cos(t)],
    2 * Math.PI * n + Math.PI, 8 * n + 4);
}

// Not system-ui: San Francisco misplaces the combining macron of q̄, t̄.
const FONT = 'Helvetica Neue, Helvetica, Arial, sans-serif';
const DASH = { scalar: '6 4', ghost: '1.5 3.5' };
const ARROW = { fermion: 1, antifermion: -1, ghost: 1 };

/**
 * SVG markup for one diagram spec {title, points: {name: [x, y]}, edges: [{from, to, type, label?, flip?}]}.
 * opts.thumb: no labels, coarser wiggles and bigger arrows, for ~64px thumbnails. opts.x/y/width/height: attributes
 * of the <svg> (for nesting in another SVG). Colours follow `currentColor`. Throws on an unknown edge type or point.
 */
export function feynmanSvg(spec, opts = {}) {
  const thumb = !!opts.thumb, k = thumb ? 2.4 : 1;
  const padX = thumb ? 18 : 46, padY = thumb ? 18 : 24;
  const pt = (name) => {
    const p = spec.points?.[name];
    if (!p) throw new Error(`diagram: unknown point "${name}"`);
    return [p[0] * U, p[1] * U];
  };
  const degree = {};
  for (const ed of spec.edges) for (const v of [ed.from, ed.to]) degree[v] = (degree[v] ?? 0) + 1;

  const lines = [], arrows = [], labels = [];
  const sw = thumb ? 1.1 : 1.5;
  for (const ed of spec.edges) {
    if (!EDGE_TYPES.includes(ed.type)) throw new Error(`diagram: unknown edge type "${ed.type}"`);
    const a = pt(ed.from), b = pt(ed.to), L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!L) throw new Error(`diagram: zero-length edge ${ed.from} → ${ed.to}`);
    const e = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    const d = ed.type === 'gluon' ? coil(a, e, L, k)
      : ed.type === 'photon' || ed.type === 'boson' ? wavy(a, e, L, k)
        : `M${n2(a[0])} ${n2(a[1])}L${n2(b[0])} ${n2(b[1])}`;
    lines.push(`<path class="fd-edge fd-${ed.type}" d="${d}" vector-effect="non-scaling-stroke"${DASH[ed.type] ? ` stroke-dasharray="${DASH[ed.type]}"` : ''}/>`);
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (ARROW[ed.type]) {
      const s = 11 * k * ARROW[ed.type], w = 4.6 * k;
      const at = (u, v) => `${n2(mid[0] + u * e[0] - v * e[1])} ${n2(mid[1] + u * e[1] + v * e[0])}`;
      arrows.push(`<path class="fd-arrow" d="M${at(s * 0.55, 0)}L${at(-s * 0.45, w)}L${at(-s * 0.45, -w)}Z"/>`);
    }
    if (ed.label && !thumb) {
      const ext = degree[ed.to] === 1 ? [b, e] : degree[ed.from] === 1 ? [a, [-e[0], -e[1]]] : null;
      let pos, dir;
      if (ext) { // external leg: just beyond its free end
        dir = ext[1];
        pos = [ext[0][0] + dir[0] * 9, ext[0][1] + dir[1] * 9];
        if (Math.abs(dir[0]) < 0.35) pos[1] += Math.sign(dir[1]) * 8;
      } else { // propagator: beside its midpoint, above (or right of a vertical line) unless flipped
        dir = Math.abs(e[0]) < 0.2 ? [Math.abs(e[1]), 0] : [e[1] * Math.sign(e[0]), -Math.abs(e[0])];
        if (ed.flip) dir = [-dir[0], -dir[1]];
        const off = ed.type === 'gluon' ? 23 : 17;
        pos = [mid[0] + dir[0] * off, mid[1] + dir[1] * off];
      }
      const anchor = Math.abs(dir[0]) < 0.35 ? 'middle' : dir[0] > 0 ? 'start' : 'end';
      labels.push(`<text x="${n2(pos[0])}" y="${n2(pos[1])}" text-anchor="${anchor}" dominant-baseline="central">${esc(ed.label)}</text>`);
    }
  }
  const dots = Object.keys(degree).filter((v) => degree[v] > 1).map((v) => {
    const [x, y] = pt(v);
    return `<circle class="fd-dot" cx="${n2(x)}" cy="${n2(y)}" r="${n2(3 * k)}"/>`;
  });
  const place = ['x', 'y', 'width', 'height'].filter((key) => opts[key] != null).map((key) => ` ${key}="${+opts[key]}"`).join('');
  const W = GRID.x * U + 2 * padX, H = GRID.y * U + 2 * padY;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="feynman${thumb ? ' fd-thumb' : ''}" viewBox="${-padX} ${-padY} ${W} ${H}" role="img"${place}>` +
    `<title>Leading-order diagram: ${esc(spec.title)}</title>` +
    `<g fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${lines.join('')}</g>` +
    `<g fill="currentColor" stroke="none">${arrows.join('')}${dots.join('')}</g>` +
    (labels.length ? `<g fill="currentColor" stroke="none" font-size="15" font-family="${FONT}">${labels.join('')}</g>` : '') +
    '</svg>';
}

/** Markup for a process's diagram, or '' when it has none (new processes may not have one yet). */
export const diagramSvg = (data, procId, opts) => (data.diagrams?.[procId] ? feynmanSvg(data.diagrams[procId], opts) : '');
