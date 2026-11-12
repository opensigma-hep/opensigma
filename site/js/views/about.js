import { el, term } from '../leaf.js';
import { statusBadge } from '../format.js';
import { lookup } from '../glossary.js';
import { REPO } from '../config.js';

// In the order a value normally moves through them; the definitions live in the glossary.
const STATUSES = ['agent-draft', 'cross-checked', 'machine-verified', 'human-verified', 'disputed'];

const a = (href, text) => el('a', { href, textContent: text });
const p = (...kids) => el('p', {}, ...kids);
const li = (...kids) => el('li', {}, ...kids);

export function render(main, data) {
  const rel = data?.build?.release;
  main.replaceChildren(
    el('h1', {}, 'About OpenSigma'),
    p('OpenSigma is a catalogue of collider processes for people who compute or use precision predictions. For each observable it records what has been measured, what theory has achieved, and the uncertainty budget of both, with a reference for every entry. Every number carries its source, the exact place in that source (the locator), and a verification status.'),
    p('It covers Standard Model processes at past, running and future colliders. It does not store cross-section values or data tables: it stores relative uncertainties, the accuracy of the calculations, and links to the papers and HEPData records that hold the numbers. Terms and abbreviations are defined in the ', a('#/glossary', 'glossary'), '; labels with a dotted underline show their definition on hover or keyboard focus.'),

    el('h2', {}, 'How to read the site'),
    el('h3', {}, 'Family matrix'),
    p('The home page lists families of processes. A family opens a matrix with one row per process and one column per collider. Each cell is a channel: that process at that collider. The cell colour is the ', term('theory ÷ experiment'), ' ratio of total uncertainties on the channel’s ', term('headline'), ' observable: below 1 theory is more precise than experiment, above 1 theory is the bottleneck. A hatched cell has no ratio because one of the two numbers is missing. The top label is the highest QCD order of any prediction in the channel; the bottom label counts measurements and ', term('candidate papers'), '. Dotted cells have partial coverage and ⚠ marks channels that may be outdated. The filters above the matrix fade the cells that do not pass.'),
    el('h3', {}, 'Process page'),
    p('A process page has two parts. The channel table has one row per collider, with the headline observable, its headline prediction and the precision of theory and of the best experiment. The ', term('building blocks'), ' table has one row per perturbative order and one column per ingredient of a fixed-order calculation (Born, loop amplitudes, real-emission pieces, infrared scheme, code). Each cell is done (●), partial (◐) or missing (○); select a cell for its references, approximations and verification status. A row can be present before any complete prediction at that order exists, to show what is still open.'),
    el('h3', {}, 'Observable page'),
    p('An observable page starts with a headline strip: the total uncertainty of the headline prediction, of the best measurement, and the ', term('theory target'), ' if a study has stated one. Below it are a chart of precision over time, the table of measurements, and the ', term('uncertainty budget'), ': the experimental and the theory uncertainty split by category, where each segment opens the individual sources with their size, locator and status. The last section lists every prediction with its accuracy chips (QCD order, EW order, mixed terms, resummation, parton-shower matching, approximations), the codes used and the measurements it was compared to.'),
    el('h3', {}, 'Other pages'),
    el('ul', {},
      li(a('#/gaps', 'Gap finder'), ': partial or missing building blocks, with the processes where theory limits precision most listed first.'),
      li(a('#/next-run', 'Next-run ranking'), ': projected measurements against today’s theory on the same observable.'),
      li(a('#/timeline', 'Theory progress'), ': how many channels had a prediction at each QCD order, by year.'),
      li(a('#/amplitudes', 'Amplitude library'), ' and ', a('#/parameters', 'Parameters'), ': loop amplitudes shared between processes, and Standard Model parameters with their determinations.')),

    el('h2', {}, 'Coverage rule'),
    p('The catalogue does not try to list every paper. This rule says what belongs in a channel.'),
    el('h3', {}, 'Measurements'),
    el('ul', {},
      li('Per channel, experiment and observable type: the most precise or most recent measurement.'),
      li('Superseded measurements stay if they are still used in global fits; they are marked “superseded by”.'),
      li('Combinations are their own measurement (experiment “combination”).'),
      li('Preliminary results only when there is no paper; they are marked “preliminary”.')),
    el('h3', {}, 'Predictions'),
    el('ul', {},
      li('Per observable: the highest accuracy along each axis (QCD, EW, mixed QCD×EW, resummation, parton-shower matching), plus any prediction the experiment compared to.'),
      li('Intermediate steps only if they introduced a new building block.')),
    el('h3', {}, 'Completeness'),
    p('Each channel states its coverage (', term('complete', { scope: 'coverage' }), ', ', term('partial', { scope: 'coverage' }), ' or ', term('stub', { scope: 'coverage' }), ') and the date it was last reviewed. Partial cells are drawn with a distinct texture; channels not reviewed for 18 months are marked as possibly outdated. Papers found by the literature search but not yet incorporated are counted per channel as candidate papers.'),

    el('h2', {}, 'Verification status'),
    p('Each number has one of five statuses, shown as a badge next to it.'),
    el('dl', { className: 'facts ladder' }, ...STATUSES.flatMap((s) => [
      el('dt', {}, term(s, { scope: 'status', cls: statusBadge(s).cls })), el('dd', {}, lookup(s, 'status').short)])),
    el('h2', {}, 'How to verify or flag a number'),
    p('Next to every number are ✓ (verify) and ⚑ (flag) links. Each opens a prefilled GitHub issue with the value, its ID, its locator, a link to the source and the page you were on. Check the value against the source, say in the comment what you checked, then submit the issue; a GitHub Action turns it into a status-only change (no value is edited).'),
    el('ul', {},
      li('One verification makes a value human-verified; the badge shows who verified it.'),
      li('One flag makes it disputed: shown in red with a link to the issue, while the value stays visible. Use it when the value, the locator or the category looks wrong, and say what you found instead.'),
      li('Your GitHub account must be at least 6 months old.')),

    el('h2', {}, 'Limitations'),
    el('ul', {},
      li('Most of the data was drafted by AI agents reading the cited papers. A status of agent-draft or cross-checked means that no person has checked the value. Treat such numbers as pointers to the source, and check the source before relying on them.'),
      li('Uncertainties are summaries: a range over the bins and a few named regions, not the full tables. The full tables are linked.'),
      li('The theory ÷ experiment ratio compares one headline number per channel. It says where to look, not how a full comparison would come out.'),
      li('Coverage follows the rule above and each channel’s review date; newer papers may be missing.')),

    el('h2', {}, 'How to cite'),
    p(rel ? `This is release ${rel.version}. The “Cite this version” button in the footer copies a BibTeX entry with its DOI.`
      : 'This build is not a tagged release, so it has no DOI yet; once a release exists, the footer shows a “Cite this version” button. Until then, cite the repository and the build date shown in the footer.',
    ' Citation metadata is in ', a(`${REPO}/blob/main/CITATION.cff`, 'CITATION.cff'), '. Please also cite the original papers: the observable pages have a “Copy BibTeX” button that collects them.'),

    el('h2', {}, 'How to contribute'),
    el('ul', {},
      li('Verify or flag numbers with the ✓ and ⚑ links. This needs only a GitHub account and the source paper.'),
      li('Correct or add data by editing the YAML files under ', el('code', {}, 'data/'), ' and opening a pull request. Every number needs a reference and a locator.'),
      li('Report a missing paper or a problem with the site as a GitHub issue.')),
    p('The steps, the file format and the checks to run are in ', a(`${REPO}/blob/main/CONTRIBUTING.md`, 'CONTRIBUTING.md'), ' and ', a(`${REPO}/blob/main/docs/data-model.md`, 'docs/data-model.md'), '.'),

    el('h2', {}, 'Licences'),
    el('ul', {},
      li('Code: MIT (', a(`${REPO}/blob/main/LICENSE`, 'LICENSE'), ').'),
      li('Data: CC BY 4.0 (', a(`${REPO}/blob/main/data/LICENSE`, 'data/LICENSE'), ').')),
    p('Source and issues: ', a(REPO, REPO)),
  );
}
