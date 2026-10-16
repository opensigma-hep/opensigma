// Pure URL builders for the ✓/⚑ issue links: no DOM.

export function issueUrl(repo, action, { uid, value, locator, link, page }) {
  const title = `${action === 'verify' ? 'Verify' : 'Flag'} ${uid}`;
  const q = { template: `${action}.yml`, title, uid, value, locator, link, page };
  return `${repo}/issues/new?` + Object.entries(q).map(([k, v]) => `${k}=${encodeURIComponent(v ?? '')}`).join('&');
}

/** Landing page for a ref string (any trailing ", locator" is ignored); '' if the format is unknown. */
export function refUrl(ref) {
  const key = String(ref).split(',')[0];
  let m;
  if ((m = /^arXiv:(.+)$/.exec(key))) return `https://arxiv.org/abs/${m[1]}`;
  if ((m = /^inspire:(\d+)$/.exec(key))) return `https://inspirehep.net/literature/${m[1]}`;
  if ((m = /^hepdata:(ins\d+)\/(.+)$/.exec(key))) return `https://www.hepdata.net/record/${m[1]}?table=${encodeURIComponent(m[2])}`;
  return '';
}
