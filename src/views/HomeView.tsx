import { ArrowRight, ExternalLink, FileJson } from 'lucide-react';
import type { AppState, LeadershipLevel } from '../types';
import type { Actions } from '../store';
import { LEADERSHIP_AXIS, LETTERS, SKILL_AXIS, formatMoney } from '../scoring';
import { REPO_URL, SOURCE, buildTemplate, downloadJson } from '../template';
import { CurrencyField } from '../components/ui';
import { RemunerationDiamond } from '../components/RemunerationDiamond';

const STEPS = [
  {
    title: 'Describe the work',
    body: 'Write your own tracks — UX design, brand, engineering, whatever your organisation actually has — and say what foundational, developed and advanced look like for each capability in them.',
  },
  {
    title: 'Agree the leadership ladder',
    body: 'One ladder for everyone: responsibility for yourself, for the team, for the organisation. It is deliberately not per-craft, so a designer and an engineer at level 2 mean the same thing.',
  },
  {
    title: 'Peers score peers',
    body: 'Everyone rates the colleagues they genuinely work with on both axes. Nobody is scored by someone who has never seen their work.',
  },
  {
    title: 'The average becomes advice',
    body: 'Peer scores are averaged into a single grade — advice, not a verdict. The team takes it from there and sets the band together, out loud, rather than leaving it to one person to decide alone.',
  },
];

export function HomeView({
  state,
  actions,
  onNavigate,
  signedIn,
  signInEnabled,
}: {
  state: AppState;
  actions: Actions;
  onNavigate: (tab: 'matrix' | 'framework' | 'assess' | 'people' | 'team') => void;
  signedIn: boolean;
  signInEnabled: boolean;
}) {
  return (
    <div className="stack">
      <section className="hero">
        <p className="hero__kicker">A two-dimensional career framework</p>
        <h2 className="hero__title">
          Pay follows the work someone does, not the title they were given.
        </h2>
        <p className="hero__lede">
          Roles have gone fluid. Most people now do more than the discipline printed on their
          title ever described, and once that happens, a single-track ladder cannot tell you
          whether the work is good. In 2022, Joost Minnaar of Corporate Rebels sketched a way
          for flat organisations to evaluate each other without a manager in the middle — a
          two-axis method, no hierarchy required. This is that method, built into a worksheet.
        </p>
        <p className="hero__lede">
          Skills &amp; capabilities run A → C. Leadership runs 1 → 3. Nine cells, a handful of
          pay bands, and a grade that peers arrive at together, not one handed down. It is a
          little radical: everyone on the team can see everyone else's scores. Career
          evaluation should not be a secret — it should be a conversation.
        </p>
        <div className="row" style={{ marginTop: 'var(--of-space-6)' }}>
          <button
            type="button"
            className="of-btn of-btn--primary of-btn--md"
            onClick={() => onNavigate('framework')}
          >
            Build your framework
            <ArrowRight size={16} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="of-btn of-btn--secondary of-btn--md"
            onClick={() => onNavigate('matrix')}
          >
            See the matrix
          </button>
        </div>
      </section>

      <section className="stack stack--tight">
        <h3 className="section-title">The two axes</h3>
        <div className="grid-2">
          <article className="of-card">
            <h3>Skills &amp; capabilities — A, B, C</h3>
            <div className="stack stack--tight" style={{ marginTop: 'var(--of-space-3)' }}>
              {LETTERS.map((letter) => (
                <p key={letter} className="muted">
                  <strong className="mono">{letter}</strong> · {SKILL_AXIS[letter].title} —{' '}
                  {SKILL_AXIS[letter].blurb}
                </p>
              ))}
            </div>
            <p className="text-xs subtle" style={{ marginTop: 'var(--of-space-3)' }}>
              Years of experience are a hint, never the test. What counts is the complexity of the
              work someone can carry.
            </p>
          </article>
          <article className="of-card">
            <h3>Leadership — 1, 2, 3</h3>
            <div className="stack stack--tight" style={{ marginTop: 'var(--of-space-3)' }}>
              {([1, 2, 3] as LeadershipLevel[]).map((level) => (
                <p key={level} className="muted">
                  <strong className="mono">{level}</strong> · {LEADERSHIP_AXIS[level].title} —{' '}
                  {LEADERSHIP_AXIS[level].blurb}
                </p>
              ))}
            </div>
            <p className="text-xs subtle" style={{ marginTop: 'var(--of-space-3)' }}>
              Leadership here is scope of responsibility, not headcount. A principal engineer with
              no reports can sit at 3.
            </p>
          </article>
        </div>
      </section>

      <section className="stack stack--tight">
        <h3 className="section-title">Nine cells, grouped into bands</h3>
        <RemunerationDiamond state={state} />
        <p className="text-xs subtle">
          It is the same diamond arrangement from {SOURCE.author}'s original illustration,
          redrawn here rather than reused —{' '}
          <a href={SOURCE.url} target="_blank" rel="noreferrer">
            see the original
            <ExternalLink size={12} strokeWidth={1.75} style={{ verticalAlign: '-1px', marginLeft: 2 }} />
          </a>
          .
        </p>
        <p className="muted">
          Different routes reach the same band on purpose: a deep specialist at 1C is paid like a
          team lead at 2B. That is the whole argument — you should not have to take on people
          management to be paid for mastery.
        </p>
        <p className="muted">
          The amounts are not set by us, and they are not handed down by one person either — the
          team decides its own bands, together, out loud. That is the radical part. This
          worksheet is built for organisations willing to work that way.
        </p>
      </section>

      <section className="stack stack--tight">
        <h3 className="section-title">How it runs</h3>
        <div className="steps">
          {STEPS.map((step, index) => (
            <article key={step.title} className="of-card step">
              <span className="step__num mono">{String(index + 1).padStart(2, '0')}</span>
              <h3>{step.title}</h3>
              <p className="muted" style={{ marginTop: 'var(--of-space-2)' }}>
                {step.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid-2">
        <article className="of-card">
          <h3>Money, in your currency</h3>
          <p className="muted" style={{ marginTop: 'var(--of-space-2)' }}>
            Nothing here assumes euros, pounds or dollars. Set whatever unit your organisation pays
            in — or clear it and show bare numbers. The seeded figures come from the original
            article and are meant to be replaced with your own market data.
          </p>
          <div style={{ marginTop: 'var(--of-space-4)' }}>
            <CurrencyField value={state.currency} onChange={actions.setCurrency} />
          </div>
          <p className="text-xs subtle" style={{ marginTop: 'var(--of-space-3)' }}>
            Preview: {formatMoney(90000, state.currency)}
          </p>
        </article>

        <article className="of-card">
          <h3>Bring your own framework</h3>
          <p className="muted" style={{ marginTop: 'var(--of-space-2)' }}>
            If you would rather write your tracks in a file than click through the editor, start
            from the template. It has the full structure, one worked track, and notes on every
            field. Fill it in, then use Import in the header.
          </p>
          <div className="row" style={{ marginTop: 'var(--of-space-4)' }}>
            <button
              type="button"
              className="of-btn of-btn--secondary of-btn--md"
              onClick={() => downloadJson(buildTemplate(), 'career-framework-template.json')}
            >
              <FileJson size={16} strokeWidth={1.75} />
              Download template
            </button>
          </div>
          <pre className="code" aria-label="Import file shape">{`{
  "currency": "€",
  "tracks": [
    { "name": "UX Design", "summary": "…",
      "capabilities": [
        { "name": "Interaction design",
          "levels": { "1": "A…", "2": "B…", "3": "C…" } }
      ] }
  ],
  "leadership": [
    { "name": "Scope of responsibility",
      "levels": { "1": "…", "2": "…", "3": "…" } }
  ],
  "bands": [ { "label": "Band 1", "grades": ["1A"], "amount": 50000 } ],
  "people": [],
  "assessments": []
}`}</pre>
        </article>
      </section>

      <section className="grid-2">
        <article className="of-card">
          <h3>Where this comes from</h3>
          <p className="muted" style={{ marginTop: 'var(--of-space-2)' }}>
            The method is not ours. {SOURCE.author} of {SOURCE.publisher} wrote it up in{' '}
            {SOURCE.year} as a way for flat organisations to set pay without a hierarchy to hang
            it on. This app is an implementation of that idea — read the original before you
            roll it out.
          </p>
          <p style={{ marginTop: 'var(--of-space-4)' }}>
            <a className="of-btn of-btn--ghost of-btn--sm" href={SOURCE.url} target="_blank" rel="noreferrer">
              {SOURCE.title}
              <ExternalLink size={14} strokeWidth={1.75} />
            </a>
          </p>
        </article>

        <article className="of-card of-card--brand-elevated">
          <p className="of-card__kicker">Contribute</p>
          <h3>Send your track back</h3>
          <div className="of-card__rule" />
          <p>
            The seeded tracks are a starting point, not a standard. If you write descriptors that
            work — for research, data, ops, support, anything we have not covered — export the JSON
            and share it back so the next team starts further along than you did.
          </p>
          {REPO_URL ? (
            <p style={{ marginTop: 'var(--of-space-4)' }}>
              <a href={REPO_URL} target="_blank" rel="noreferrer">
                Open the repository
              </a>
            </p>
          ) : null}
        </article>
      </section>

      <section className="of-card">
        <h3>Two things to be honest about</h3>
        <div className="stack stack--tight" style={{ marginTop: 'var(--of-space-3)' }}>
          <p className="muted">
            <strong>Two places your work can live.</strong> The local workspace keeps everything in
            this browser — private, and gone if you clear your browser data. A team workspace stores
            the framework and every score on the server so colleagues can score each other, and
            everyone in the team can see who scored whom.
          </p>
          <p className="muted">
            <strong>A grade is the start of a conversation.</strong> Averaging peer opinion produces
            a tidy number from an untidy judgement. Where peers disagree, or an average lands on the
            line between two levels, the app says so rather than hiding it.
          </p>
        </div>
        <div className="row" style={{ marginTop: 'var(--of-space-4)' }}>
          <button
            type="button"
            className="of-btn of-btn--primary of-btn--md"
            onClick={() => onNavigate('people')}
          >
            Add the first person
            <ArrowRight size={16} strokeWidth={1.75} />
          </button>
          {signInEnabled && !signedIn ? (
            <button
              type="button"
              className="of-btn of-btn--secondary of-btn--md"
              onClick={() => onNavigate('team')}
            >
              Work with a team instead
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
