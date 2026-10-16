import { el, none, link, idLink, index, facts, refList, prov } from '../leaf.js';

export function render(main, data, route) {
  const amp = index(data).get(route.id).node;
  const users = data.derived.amp_users?.[amp.id] ?? [];
  const mi = amp.master_integrals;
  main.replaceChildren(
    el('nav', { className: 'crumbs' }, link('', 'Families'), ' › ', idLink(data, amp.process)),
    el('h1', {}, amp.id),
    facts([
      ['Process', idLink(data, amp.process)], ['Loops', String(amp.loops)], ['Corrections', amp.corrections],
      ['Status', amp.status], ['Approximations', amp.approximations?.length ? amp.approximations.join(', ') : null],
      ['Master integrals', mi ? [mi.status, ' · ', ...refList(mi.refs, data.refs)] : 'not recorded'],
      ['References', refList(amp.refs, data.refs)],
      ['Record', prov(amp.provenance, `${amp.id}: ${amp.status}`)],
    ]),
    el('h2', {}, 'Used by'),
    users.length ? el('ul', {}, ...users.map((u) => el('li', {}, ...(u.process
      ? ['Building block ', idLink(data, u.process), `: ${u.row} / ${u.column}`]
      : ['Prediction “', u.prediction_label, '” on ', idLink(data, u.observable)])))) : none('users'),
  );
}
