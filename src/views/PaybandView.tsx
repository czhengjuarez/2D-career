import type { Actions } from '../store';
import type { AppState, Grade, LeadershipLevel, SkillLetter } from '../types';
import { LEADERSHIP_AXIS, LETTERS, SKILL_AXIS, bandFor, formatMoney } from '../scoring';
import { CurrencyField, PageHead } from '../components/ui';

const LEAD_ROWS: LeadershipLevel[] = [3, 2, 1];

/**
 * Payband design is deliberately independent of team evaluation. This page defines what
 * each of the nine grades is worth; it never reads a person, a score, or a track filter —
 * that data lives in Assess/People/Framework instead. See the "Two separate things" card
 * below for the explanation shown to users.
 *
 * A second, related idea lives here too: descriptors (what "advanced" means for a given
 * capability) are legitimately team-specific, but pay and the leadership ladder are meant to
 * hold organisation-wide. Today that's a framing, not an enforced constraint — bands are
 * still stored per team, so nothing stops two teams under one org from setting a 2B
 * differently. Worth knowing if "organisational" needs to become literally true later.
 */
export function PaybandView({ state, actions }: { state: AppState; actions: Actions }) {
  return (
    <div className="stack">
      <PageHead title="Org Payband" />

      <article className="of-card">
        <p className="section-title">Two separate things</p>
        <blockquote className="pull-quote" style={{ marginTop: 'var(--of-space-3)' }}>
          The descriptors are team-specific. The principles are organisational. Teams should
          have the freedom to define what great UX Design or Engineering looks like in their
          context, but organisations still owe people consistency in how leadership, scope,
          and compensation are interpreted. Otherwise, flexibility simply becomes another word
          for unfairness.
        </blockquote>
        <p className="muted" style={{ marginTop: 'var(--of-space-4)' }}>
          So payband is kept separate from evaluation: this page only ever edits what a grade
          is worth. Scoring, grades and who's currently at what level happen on{' '}
          <strong>Assess</strong> and <strong>People</strong> instead.
        </p>
      </article>

      <article className="of-card">
        <h3>Currency</h3>
        <p className="muted" style={{ marginTop: 'var(--of-space-2)' }}>
          Nothing here assumes euros, pounds or dollars. Set whatever unit the organisation
          pays in, or clear it for bare numbers.
        </p>
        <div style={{ marginTop: 'var(--of-space-4)' }}>
          <CurrencyField value={state.currency} onChange={actions.setCurrency} />
        </div>
        <p className="text-xs subtle" style={{ marginTop: 'var(--of-space-3)' }}>
          Preview: {formatMoney(90000, state.currency)}
        </p>
      </article>

      <p className="muted">
        Nine grades, one pay figure each. Skill runs A → C across the bottom; leadership runs
        1 → 3 up the side. This is where the organisation agrees what each grade is worth — on
        its own, independent of anyone's actual evaluation.
      </p>

      <div className="matrix-wrap">
        <div className="matrix-yaxis">Leadership →</div>
        <div>
          <div className="matrix">
            {LEAD_ROWS.map((lead) =>
              LETTERS.map((letter: SkillLetter) => {
                const grade = `${lead}${letter}` as Grade;
                const band = bandFor(state, grade);
                return (
                  <div key={grade} className="cell">
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="cell__grade">{grade}</span>
                      {band ? <span className="of-badge of-badge--default">{band.label}</span> : null}
                    </div>
                    {band ? (
                      <label className="field-inline">
                        <span>{state.currency.trim() ? `Pay (${state.currency.trim()})` : 'Pay'}</span>
                        <input
                          className="of-input"
                          type="number"
                          step={1000}
                          value={band.amount}
                          onChange={(e) => actions.updateBand(band.id, Number(e.target.value) || 0)}
                          aria-label={`Pay for ${band.label}`}
                        />
                      </label>
                    ) : (
                      <span className="cell__pay subtle">—</span>
                    )}
                    <span className="cell__meta">
                      {LEADERSHIP_AXIS[lead].title} · {SKILL_AXIS[letter].title}
                    </span>
                  </div>
                );
              }),
            )}
          </div>
          <div className="matrix-xaxis">
            {LETTERS.map((letter) => (
              <div key={letter} className="axis-label">
                <strong>{letter}</strong>
                {SKILL_AXIS[letter].title}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <article className="of-card">
          <h3>Skills &amp; capabilities</h3>
          <div className="stack stack--tight" style={{ marginTop: 'var(--of-space-3)' }}>
            {LETTERS.map((letter) => (
              <p key={letter} className="muted">
                <strong className="mono">{letter}</strong> — {SKILL_AXIS[letter].blurb}
              </p>
            ))}
          </div>
        </article>
        <article className="of-card">
          <h3>Leadership</h3>
          <div className="stack stack--tight" style={{ marginTop: 'var(--of-space-3)' }}>
            {([1, 2, 3] as LeadershipLevel[]).map((lead) => (
              <p key={lead} className="muted">
                <strong className="mono">{lead}</strong> — {LEADERSHIP_AXIS[lead].blurb}
              </p>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}
