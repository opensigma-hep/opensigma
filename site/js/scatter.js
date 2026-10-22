import { toHash } from './router.js';

/** x = best experimental total %, y = headline prediction total %; observables lacking either are skipped. */
export function scatterPoints(summary, includeProj) {
  const xk = includeProj ? 'exp_pct_with_projections' : 'exp_pct';
  return Object.entries(summary)
    .filter(([, s]) => s[xk] > 0 && s.th_pct > 0)
    .map(([id, s]) => ({ id, x: s[xk], y: s.th_pct }));
}

/** points: [{id, x, y, name, color?}]; draws into `el` using the global d3 (loaded from cdnjs in index.html). */
export function drawScatter(el, points) {
  const d3 = window.d3;
  el.replaceChildren();
  if (!points.length) {
    el.textContent = 'No observable in this view has both an experimental and a theory uncertainty.';
    return;
  }
  const W = 440, H = 440, m = { t: 16, r: 16, b: 48, l: 56 };
  const all = points.flatMap((p) => [p.x, p.y]);
  const dom = [Math.min(...all) / 1.5, Math.max(...all) * 1.5];
  const x = d3.scaleLog(dom, [m.l, W - m.r]);
  const y = d3.scaleLog(dom, [H - m.b, m.t]);
  const svg = d3.select(el).append('svg').attr('class', 'scatter').attr('viewBox', `0 0 ${W} ${H}`)
    .attr('role', 'group').attr('aria-label', 'Theory versus experimental total uncertainty, log-log');
  const fmt = (v) => `${+v.toPrecision(2)}`;
  const ticks = (s) => s.ticks(5).filter((t) => Math.log10(t) % 1 === 0 || s.ticks().length < 8);
  svg.append('g').attr('class', 'grid').selectAll('line').data(ticks(y)).join('line')
    .attr('x1', m.l).attr('x2', W - m.r).attr('y1', y).attr('y2', y);
  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${H - m.b})`)
    .call(d3.axisBottom(x).tickValues(ticks(x)).tickFormat(fmt));
  svg.append('g').attr('class', 'axis').attr('transform', `translate(${m.l},0)`)
    .call(d3.axisLeft(y).tickValues(ticks(y)).tickFormat(fmt));
  svg.append('text').attr('class', 'axis-label').attr('x', (m.l + W - m.r) / 2).attr('y', H - 10)
    .attr('text-anchor', 'middle').text('Experimental total uncertainty (%)');
  svg.append('text').attr('class', 'axis-label').attr('transform', `translate(14,${(m.t + H - m.b) / 2}) rotate(-90)`)
    .attr('text-anchor', 'middle').text('Theory total uncertainty (%)');
  svg.append('line').attr('class', 'diag').attr('x1', x(dom[0])).attr('y1', y(dom[0])).attr('x2', x(dom[1])).attr('y2', y(dom[1]));
  svg.append('text').attr('class', 'axis-label').attr('x', m.l + 6).attr('y', m.t + 12).text('theory limits (above y = x)');
  svg.append('text').attr('class', 'axis-label').attr('x', W - m.r - 6).attr('y', H - m.b - 8)
    .attr('text-anchor', 'end').text('experiment limits (below)');
  svg.append('g').selectAll('a').data(points).join('a')
    .attr('href', (p) => toHash(p.id))
    .attr('aria-label', (p) => `${p.name}: experiment ${fmt(p.x)}%, theory ${fmt(p.y)}%`)
    .call((a) => a.append('title').text((p) => `${p.name}: exp ${fmt(p.x)}%, theory ${fmt(p.y)}%`))
    .append('circle').attr('class', 'pt').attr('cx', (p) => x(p.x)).attr('cy', (p) => y(p.y)).attr('r', 6)
    .style('fill', (p) => p.color ?? null); // optional per-point colour (home page: by family)
}
