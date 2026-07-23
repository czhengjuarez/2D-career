import { useMemo, useState } from 'react';
import type { Actions } from '../store';
import type { AppState, Grade, LeadershipLevel, SkillLetter } from '../types';
import {
  LEADERSHIP_AXIS,
  LETTERS,
  SKILL_AXIS,
  bandFor,
  scorePerson,
} from '../scoring';
import { PageHead } from '../components/ui';

const LEAD_ROWS: LeadershipLevel[] = [3, 2, 1];

export function MatrixView({ state, actions }: { state: AppState; actions: Actions }) {
  const [trackFilter, setTrackFilter] = useState('all');

  const scored = useMemo(
    () =>
      state.people
        .filter((p) => trackFilter === 'all' || p.trackId === trackFilter)
        .map((p) => scorePerson(state, p))
        .filter((s) => s.grade != null),
    [state, trackFilter],
  );

  const byGrade = useMemo(() => {
    const map = new Map<Grade, string[]>();
    for (const s of scored) {
      if (!s.grade) continue;
      map.set(s.grade, [...(map.get(s.grade) ?? []), s.person.name]);
    }
    return map;
  }, [scored]);

  return (
    <div className="stack">
      <PageHead
        title="The 3 × 3"
        aside={
          <label className="of-field" style={{ minWidth: 200 }}>
            <span className="of-label">Show people from</span>
            <select
              className="of-select"
              value={trackFilter}
              onChange={(e) => setTrackFilter(e.target.value)}
            >
              <option value="all">All tracks</option>
              {state.tracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        }
      >
        Two axes, three levels each. Skills &amp; capabilities run A → C across the bottom;
        leadership runs 1 → 3 up the side. Nine cells, grouped into pay bands — a grade is peer
        advice, not a decision. Pay figures are editable.
      </PageHead>

      <div className="matrix-wrap">
        <div className="matrix-yaxis">Leadership →</div>
        <div>
          <div className="matrix">
            {LEAD_ROWS.map((lead) =>
              LETTERS.map((letter: SkillLetter) => {
                const grade = `${lead}${letter}` as Grade;
                const band = bandFor(state, grade);
                const names = byGrade.get(grade) ?? [];
                return (
                  <div key={grade} className={`cell${names.length ? ' cell--active' : ''}`}>
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
                    <div className="cell__people">
                      {names.map((n) => (
                        <span key={n} className="chip">
                          {n}
                        </span>
                      ))}
                    </div>
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

      <article className="of-card of-card--brand-elevated">
        <p className="of-card__kicker">How it runs</p>
        <h3>Peers score, the commission decides</h3>
        <p style={{ marginTop: 'var(--of-space-3)' }}>
          Everyone rates the colleagues they actually work with on both axes. Those peer scores are
          averaged into one grade, and that grade is <em>advice</em> to whoever owns pay — a
          remuneration commission or leadership — who convert it into a package.
        </p>
      </article>
    </div>
  );
}
