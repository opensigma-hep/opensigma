import { el, fill, none, link, idLink, index, facts, refList, prov, evalChip, term, sep } from '../leaf.js';

export function render(main, data, route) {
  const amp = index(data).get(route.id).node;
  const users = data.derived.amp_users?.[amp.id] ?? [];
  const mi = amp.master_integrals, ev = amp.evaluation;
  fill(main,
    el('nav', { className: 'crumbs' }, link('', 'Families'), ' › ', el('a', { href: '#/amplitudes' }, 'Amplitudes')),
    el('h1', {}, amp.id),
    facts([
      ['Process', idLink(data, amp.process)], ['Loops', String(amp.loops)], ['Corrections', amp.corrections],
      ['Status', term(amp.status, { scope: 'bb' })], ['Approximations', amp.approximations?.length ? sep(amp.approximations.map((x) => term(x, { loose: true }))) : null],
      [term('Master integrals'), mi ? [mi.status, ' · ', ...refList(mi.refs, data.refs)] : 'not recorded'],
      [term('Evaluation'), ev ? [evalChip(ev), ev.detail ? ' ' + ev.detail : '', ' ', prov(ev.provenance, `${amp.id}: ${ev.kind}`)] : 'not recorded'],
      ['References', refList(amp.refs, data.refs)],
      ['Record', prov(amp.provenance, `${amp.id}: ${amp.status}`)],
    ]),
    el('h2', {}, 'Used by'),
    users.length ? el('ul', {}, ...users.map((u) => el('li', {}, ...(u.process
      ? ['Building block ', idLink(data, u.process), `: ${u.row} / ${u.column}`]
      : ['Prediction “', u.prediction_label, '” on ', idLink(data, u.observable)])))) : none('users'),
  );
}
