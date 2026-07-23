import { useState } from 'react';
import { Plus, UserCheck } from 'lucide-react';
import type { Actions } from '../store';
import type { AppState } from '../types';
import { bandFor, formatMoney, gradeOf, scoreAssessment, scorePerson } from '../scoring';
import { DeleteButton, GradeBadge, Meter, PageHead } from '../components/ui';

export function PeopleView({
  state,
  actions,
  viewer,
}: {
  state: AppState;
  actions: Actions;
  /** In a team, only the rater or an admin may withdraw a score. */
  viewer: { userId: string | null; isAdmin: boolean; isTeam: boolean };
}) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [trackId, setTrackId] = useState(state.tracks[0]?.id ?? '');

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed || !trackId) return;
    actions.addPerson({ name: trimmed, role: role.trim(), trackId });
    setName('');
    setRole('');
  };

  const scores = state.people.map((p) => scorePerson(state, p));
  const isMe = (person: { accountId?: string }) =>
    Boolean(viewer.userId && person.accountId === viewer.userId);

  return (
    <div className="stack">
      <PageHead title="People">
        Everyone who is scored, with the averaged peer advice and the band it points to. Spread
        shows how far apart peers landed — a wide spread is a conversation, not a number to split.
        {viewer.isTeam
          ? ' Joining the team adds you here automatically; if you were already on the list under another row, mark it as you.'
          : ''}
      </PageHead>

      <div className="of-card">
        <div className="row">
          <label className="of-field" style={{ flex: 1, minWidth: 180 }}>
            <span className="of-label">Name</span>
            <input
              className="of-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
          </label>
          <label className="of-field" style={{ flex: 1, minWidth: 180 }}>
            <span className="of-label">Role title</span>
            <input
              className="of-input"
              value={role}
              placeholder="Optional"
              onChange={(e) => setRole(e.target.value)}
            />
          </label>
          <label className="of-field" style={{ minWidth: 180 }}>
            <span className="of-label">Track</span>
            <select
              className="of-select"
              value={trackId}
              onChange={(e) => setTrackId(e.target.value)}
            >
              {state.tracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="of-btn of-btn--primary of-btn--md" onClick={add}>
            <Plus size={16} strokeWidth={1.75} />
            Add person
          </button>
        </div>
      </div>

      {state.people.length === 0 ? (
        <div className="empty">No one yet. Add a person above, then score them on Assess.</div>
      ) : (
        <div className="of-card scroll-x">
          <table className="data">
            <thead>
              <tr>
                <th>Person</th>
                <th>Track</th>
                <th>Peers</th>
                <th>Skills</th>
                <th>Leadership</th>
                <th>Grade</th>
                <th>Band</th>
                <th>Spread</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {scores.map((s) => {
                const band = bandFor(state, s.grade);
                const selfGrade =
                  s.selfSkill != null && s.selfLeadership != null
                    ? gradeOf(s.selfSkill, s.selfLeadership)
                    : null;
                return (
                  <tr key={s.person.id}>
                    <td>
                      <div className="list-row__name">
                        {s.person.name}
                        {isMe(s.person) ? (
                          <span className="of-badge of-badge--green" style={{ marginLeft: 'var(--of-space-2)' }}>
                            you
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs muted">
                        {s.person.role || '—'}
                        {selfGrade ? ` · self: ${selfGrade}` : ''}
                      </div>
                      {viewer.isTeam && !s.person.accountId ? (
                        <button
                          type="button"
                          className="of-btn of-btn--ghost of-btn--sm"
                          style={{ marginTop: 'var(--of-space-1)' }}
                          onClick={() => actions.claimPerson(s.person.id)}
                        >
                          <UserCheck size={14} strokeWidth={1.75} />
                          That's me
                        </button>
                      ) : null}
                    </td>
                    <td>
                      {viewer.isTeam ? (
                        <select
                          className="of-select"
                          style={{ maxWidth: 150 }}
                          aria-label={`Track for ${s.person.name}`}
                          value={s.person.trackId}
                          onChange={(e) =>
                            actions.updatePerson(s.person.id, { trackId: e.target.value })
                          }
                        >
                          {state.tracks.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="muted">{s.track?.name ?? '—'}</span>
                      )}
                    </td>
                    <td className="mono">{s.peerCount}</td>
                    <td>
                      <div className="row" style={{ gap: 'var(--of-space-2)', flexWrap: 'nowrap' }}>
                        <Meter value={s.skill} />
                        <span className="mono text-xs">{s.skill?.toFixed(2) ?? '—'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 'var(--of-space-2)', flexWrap: 'nowrap' }}>
                        <Meter value={s.leadership} />
                        <span className="mono text-xs">{s.leadership?.toFixed(2) ?? '—'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 'var(--of-space-2)', flexWrap: 'nowrap' }}>
                        <GradeBadge grade={s.grade} />
                        {s.borderline ? (
                          <span
                            className="of-badge of-badge--amber"
                            title="An average sits on the line between two levels — the rounded grade is arbitrary. Talk it through."
                          >
                            on the line
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="mono">
                      {band ? formatMoney(band.amount, state.currency) : '—'}
                    </td>
                    <td>
                      {s.spread == null ? (
                        <span className="subtle">—</span>
                      ) : (
                        <span
                          className={`of-badge of-badge--${
                            s.spread >= 1.5 ? 'red' : s.spread >= 0.75 ? 'amber' : 'green'
                          }`}
                        >
                          {s.spread.toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td>
                      <DeleteButton
                        label={`Remove ${s.person.name}`}
                        onClick={() => actions.removePerson(s.person.id)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {state.assessments.length > 0 ? (
        <section className="stack stack--tight">
          <h3 className="section-title">Individual scores</h3>
          <div className="list">
            {state.assessments
              .slice()
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((assessment) => {
                const scored = scoreAssessment(assessment);
                const person = state.people.find((p) => p.id === assessment.personId);
                const grade =
                  scored.skill != null && scored.leadership != null
                    ? gradeOf(scored.skill, scored.leadership)
                    : null;
                return (
                  <div key={assessment.id} className="list-row">
                    <div className="list-row__main">
                      <div className="list-row__name">
                        {person?.name ?? 'Removed'}{' '}
                        <span className="muted" style={{ fontWeight: 400 }}>
                          ← {assessment.rater}
                        </span>
                      </div>
                      <div className="text-xs muted">
                        {new Date(assessment.date).toLocaleDateString()}
                        {assessment.note ? ` · ${assessment.note}` : ''}
                      </div>
                    </div>
                    <span
                      className={`of-badge of-badge--${
                        assessment.kind === 'self' ? 'default' : 'blue'
                      }`}
                    >
                      {assessment.kind}
                    </span>
                    <GradeBadge grade={grade} />
                    {!viewer.isTeam ||
                    viewer.isAdmin ||
                    !assessment.raterId ||
                    assessment.raterId === viewer.userId ? (
                      <DeleteButton
                        label="Delete score"
                        onClick={() => actions.removeAssessment(assessment.id)}
                      />
                    ) : (
                      <span className="icon-spacer" aria-hidden />
                    )}
                  </div>
                );
              })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
