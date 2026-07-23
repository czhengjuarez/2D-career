import { useEffect, useMemo, useState } from 'react';
import type { Actions } from '../store';
import type { AppState, LeadershipLevel, SkillLevel } from '../types';
import { gradeOf } from '../scoring';
import { GradeBadge, LevelPicker, PageHead } from '../components/ui';

export function AssessView({
  state,
  actions,
  onDone,
  identity,
  myPersonId,
}: {
  state: AppState;
  actions: Actions;
  onDone: () => void;
  /** In a team the rater is the signed-in account, so the name is not up for grabs. */
  identity: string | null;
  /** The roster row claimed by the signed-in account, if there is one. */
  myPersonId: string | null;
}) {
  const [personId, setPersonId] = useState(state.people[0]?.id ?? '');
  const [rater, setRater] = useState('');
  const [kind, setKind] = useState<'self' | 'peer'>('peer');
  const [skills, setSkills] = useState<Record<string, SkillLevel>>({});
  const [leadership, setLeadership] = useState<Record<string, LeadershipLevel>>({});
  const [note, setNote] = useState('');

  // Picking yourself flips the type over, because a peer score of yourself is not one.
  useEffect(() => {
    if (myPersonId && personId === myPersonId) setKind('self');
    else setKind('peer');
  }, [personId, myPersonId]);

  const scoringSelf = Boolean(myPersonId && personId === myPersonId);
  const person = state.people.find((p) => p.id === personId);
  const track = state.tracks.find((t) => t.id === person?.trackId);
  const capabilities = track?.capabilities ?? [];

  const answered = Object.keys(skills).length + Object.keys(leadership).length;
  const total = capabilities.length + state.leadership.length;
  const complete = total > 0 && answered === total;

  const preview = useMemo(() => {
    const skillValues = Object.values(skills);
    const leadValues = Object.values(leadership);
    if (skillValues.length === 0 || leadValues.length === 0) return null;
    const s = skillValues.reduce((a, b) => a + b, 0) / skillValues.length;
    const l = leadValues.reduce((a, b) => a + b, 0) / leadValues.length;
    return { skill: s, leadership: l, grade: gradeOf(s, l) };
  }, [skills, leadership]);

  const reset = () => {
    setSkills({});
    setLeadership({});
    setNote('');
    setRater('');
  };

  const submit = () => {
    if (!person || !complete) return;
    actions.addAssessment({
      personId: person.id,
      rater: identity ?? rater.trim() ?? 'Anonymous',
      kind,
      date: new Date().toISOString(),
      skills,
      leadership,
      note: note.trim(),
    });
    reset();
    onDone();
  };

  if (state.people.length === 0) {
    return (
      <div className="stack">
        <PageHead title="Assess">
          Rate a colleague you actually work with, capability by capability.
        </PageHead>
        <div className="empty">Add someone on the People tab first — then you can score them.</div>
      </div>
    );
  }

  return (
    <div className="stack">
      <PageHead title="Assess">
        Score only the people you collaborate with regularly, and score the level that fits their
        work as it is today — not the one you hope they reach. Self-assessments are recorded and
        shown, but never counted toward the grade.
      </PageHead>

      <div className="of-card">
        <div className="row">
          <label className="of-field" style={{ flex: 1, minWidth: 200 }}>
            <span className="of-label">Who are you scoring?</span>
            <select
              className="of-select"
              value={personId}
              onChange={(e) => {
                setPersonId(e.target.value);
                setSkills({});
                setLeadership({});
              }}
            >
              {state.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="of-field" style={{ flex: 1, minWidth: 180 }}>
            <span className="of-label">Your name</span>
            <input
              className="of-input"
              value={identity ?? rater}
              disabled={Boolean(identity)}
              placeholder="Optional"
              onChange={(e) => setRater(e.target.value)}
            />
            {identity ? (
              <span className="of-field__hint">
                Taken from your account — every team member sees who scored whom.
              </span>
            ) : null}
          </label>
          <label className="of-field" style={{ minWidth: 160 }}>
            <span className="of-label">Type</span>
            <select
              className="of-select"
              value={kind}
              onChange={(e) => setKind(e.target.value as 'self' | 'peer')}
            >
              <option value="peer">Peer score (counts)</option>
              <option value="self">Self score (reference)</option>
            </select>
          </label>
        </div>
        {scoringSelf ? (
          <p
            className={`text-xs ${kind === 'peer' ? 'of-field__error' : 'muted'}`}
            style={{ marginTop: 'var(--of-space-3)' }}
          >
            {kind === 'peer'
              ? 'This is your own row — scoring yourself as a peer would count toward your own grade. Switch to a self score.'
              : 'This is your own row. Self scores are kept and shown next to the peer average, but never counted.'}
          </p>
        ) : null}
        <p className="text-xs muted" style={{ marginTop: 'var(--of-space-3)' }}>
          Track: <strong>{track?.name ?? 'None'}</strong>
          {track?.summary ? ` — ${track.summary}` : ''}
        </p>
      </div>

      <section className="stack stack--tight">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 className="section-title">Skills &amp; capabilities (A / B / C)</h3>
          <span className="progress-note">
            {Object.keys(skills).length}/{capabilities.length}
          </span>
        </div>
        {capabilities.length === 0 ? (
          <div className="empty">This track has no capabilities yet. Add some on the Framework tab.</div>
        ) : (
          capabilities.map((capability) => (
            <div key={capability.id} className="of-card">
              <div className="list-row__name">{capability.name}</div>
              <div style={{ marginTop: 'var(--of-space-3)' }}>
                <LevelPicker
                  axis="skill"
                  name={capability.name}
                  descriptors={capability.levels}
                  value={skills[capability.id]}
                  onChange={(level) =>
                    setSkills((prev) => ({ ...prev, [capability.id]: level as SkillLevel }))
                  }
                />
              </div>
            </div>
          ))
        )}
      </section>

      <section className="stack stack--tight">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 className="section-title">Leadership (1 / 2 / 3)</h3>
          <span className="progress-note">
            {Object.keys(leadership).length}/{state.leadership.length}
          </span>
        </div>
        {state.leadership.map((dimension) => (
          <div key={dimension.id} className="of-card">
            <div className="list-row__name">{dimension.name}</div>
            <div style={{ marginTop: 'var(--of-space-3)' }}>
              <LevelPicker
                axis="leadership"
                name={dimension.name}
                descriptors={dimension.levels}
                value={leadership[dimension.id]}
                onChange={(level) =>
                  setLeadership((prev) => ({ ...prev, [dimension.id]: level as LeadershipLevel }))
                }
              />
            </div>
          </div>
        ))}
      </section>

      <div className="of-card">
        <label className="of-field">
          <span className="of-label">Evidence or context (optional)</span>
          <textarea
            className="of-textarea"
            rows={3}
            value={note}
            placeholder="What did you see that led you to these levels?"
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <div className="row" style={{ marginTop: 'var(--of-space-4)' }}>
          <span className="muted text-xs">
            This score:{' '}
            {preview ? (
              <>
                skills {preview.skill.toFixed(2)} · leadership {preview.leadership.toFixed(2)}
              </>
            ) : (
              'not enough answers yet'
            )}
          </span>
          <GradeBadge grade={preview?.grade ?? null} />
          <span className="spacer" />
          <button type="button" className="of-btn of-btn--ghost of-btn--md" onClick={reset}>
            Clear
          </button>
          <button
            type="button"
            className={`of-btn of-btn--primary of-btn--md${complete ? '' : ' of-btn--disabled'}`}
            disabled={!complete}
            onClick={submit}
          >
            Submit score
          </button>
        </div>
        {!complete ? (
          <p className="text-xs subtle" style={{ marginTop: 'var(--of-space-2)' }}>
            Answer all {total} items to submit — a partial score would skew the average.
          </p>
        ) : null}
      </div>
    </div>
  );
}
