import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { Actions } from '../store';
import type { AppState, LeadershipLevel, LevelDescriptors } from '../types';
import { LEADERSHIP_AXIS, LETTERS, SKILL_AXIS, formatMoney } from '../scoring';
import { CurrencyField, DeleteButton, PageHead } from '../components/ui';

const LEVELS: (1 | 2 | 3)[] = [1, 2, 3];

function DescriptorRow({
  axis,
  levels,
  onChange,
}: {
  axis: 'skill' | 'leadership';
  levels: LevelDescriptors;
  onChange: (levels: LevelDescriptors) => void;
}) {
  return (
    <div className="levels">
      {LEVELS.map((level) => {
        const key = axis === 'skill' ? LETTERS[level - 1] : String(level);
        const placeholder =
          axis === 'skill'
            ? SKILL_AXIS[LETTERS[level - 1]].blurb
            : LEADERSHIP_AXIS[level as LeadershipLevel].blurb;
        return (
          <label key={level} className="field-inline">
            <span>
              {key} ·{' '}
              {axis === 'skill'
                ? SKILL_AXIS[LETTERS[level - 1]].title
                : LEADERSHIP_AXIS[level as LeadershipLevel].title}
            </span>
            <textarea
              className="of-textarea"
              rows={3}
              placeholder={placeholder}
              value={levels[level]}
              onChange={(e) => onChange({ ...levels, [level]: e.target.value })}
            />
          </label>
        );
      })}
    </div>
  );
}

function AddInline({
  placeholder,
  cta,
  onAdd,
}: {
  placeholder: string;
  cta: string;
  onAdd: (value: string) => void;
}) {
  const [value, setValue] = useState('');
  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue('');
  };
  return (
    <div className="row">
      <input
        className="of-input"
        style={{ flex: 1, minWidth: 200 }}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        }}
      />
      <button type="button" className="of-btn of-btn--secondary of-btn--md" onClick={submit}>
        <Plus size={16} strokeWidth={1.75} />
        {cta}
      </button>
    </div>
  );
}

export function FrameworkView({ state, actions }: { state: AppState; actions: Actions }) {
  return (
    <div className="stack">
      <PageHead title="Framework">
        Tracks hold the skills &amp; capabilities specific to a craft. Leadership is deliberately
        shared across the whole organisation — the same ladder for a designer and an engineer.
        Everything here is yours to rewrite; the seeded examples are only a starting point.
      </PageHead>

      <section className="stack stack--tight">
        <h3 className="section-title">Tracks &amp; capabilities</h3>
        <div>
          {state.tracks.map((track) => (
            <details key={track.id} className="disc">
              <summary>
                {track.name}
                <span className="of-badge of-badge--default">
                  {track.capabilities.length} capabilities
                </span>
              </summary>
              <div className="disc__body">
                <div className="row">
                  <label className="of-field" style={{ flex: 1, minWidth: 200 }}>
                    <span className="of-label">Track name</span>
                    <input
                      className="of-input"
                      value={track.name}
                      onChange={(e) => actions.updateTrack(track.id, { name: e.target.value })}
                    />
                  </label>
                  <label className="of-field" style={{ flex: 2, minWidth: 240 }}>
                    <span className="of-label">Summary</span>
                    <input
                      className="of-input"
                      value={track.summary}
                      placeholder="What this track is responsible for"
                      onChange={(e) => actions.updateTrack(track.id, { summary: e.target.value })}
                    />
                  </label>
                  <DeleteButton
                    label={`Delete ${track.name}`}
                    onClick={() => actions.removeTrack(track.id)}
                  />
                </div>

                {track.capabilities.map((capability) => (
                  <div key={capability.id} className="stack stack--tight">
                    <div className="row">
                      <input
                        className="of-input"
                        style={{ flex: 1, minWidth: 200, fontWeight: 600 }}
                        value={capability.name}
                        onChange={(e) =>
                          actions.updateCapability(track.id, capability.id, {
                            name: e.target.value,
                          })
                        }
                      />
                      <DeleteButton
                        label={`Delete ${capability.name}`}
                        onClick={() => actions.removeCapability(track.id, capability.id)}
                      />
                    </div>
                    <DescriptorRow
                      axis="skill"
                      levels={capability.levels}
                      onChange={(levels) =>
                        actions.updateCapability(track.id, capability.id, { levels })
                      }
                    />
                  </div>
                ))}

                <AddInline
                  placeholder="New capability, e.g. Facilitation"
                  cta="Add capability"
                  onAdd={(name) => actions.addCapability(track.id, name)}
                />
              </div>
            </details>
          ))}
        </div>
        <AddInline
          placeholder="New track, e.g. Data Science"
          cta="Add track"
          onAdd={actions.addTrack}
        />
      </section>

      <section className="stack stack--tight">
        <h3 className="section-title">Leadership dimensions (shared by everyone)</h3>
        <div>
          {state.leadership.map((dimension) => (
            <details key={dimension.id} className="disc">
              <summary>{dimension.name}</summary>
              <div className="disc__body">
                <div className="row">
                  <input
                    className="of-input"
                    style={{ flex: 1, minWidth: 200, fontWeight: 600 }}
                    value={dimension.name}
                    onChange={(e) => actions.updateLeadership(dimension.id, { name: e.target.value })}
                  />
                  <DeleteButton
                    label={`Delete ${dimension.name}`}
                    onClick={() => actions.removeLeadership(dimension.id)}
                  />
                </div>
                <DescriptorRow
                  axis="leadership"
                  levels={dimension.levels}
                  onChange={(levels) => actions.updateLeadership(dimension.id, { levels })}
                />
              </div>
            </details>
          ))}
        </div>
        <AddInline
          placeholder="New leadership desire, e.g. Stewardship of the craft"
          cta="Add dimension"
          onAdd={actions.addLeadership}
        />
      </section>

      <section className="stack stack--tight">
        <h3 className="section-title">Pay bands</h3>
        <p className="muted text-xs">
          Decide these together, out loud — a change here changes what everyone in the band is
          paid the moment it saves.
        </p>
        <div className="of-card">
          <div className="row" style={{ marginBottom: 'var(--of-space-4)' }}>
            <CurrencyField value={state.currency} onChange={actions.setCurrency} />
          </div>
          <div className="list">
            {state.bands.map((band) => (
              <div key={band.id} className="list-row">
                <div className="list-row__main">
                  <div className="list-row__name">{band.label}</div>
                  <div className="text-xs muted mono">{band.grades.join(' · ')}</div>
                </div>
                <span className="mono text-xs muted">{formatMoney(band.amount, state.currency)}</span>
                <input
                  className="of-input"
                  style={{ maxWidth: 160 }}
                  type="number"
                  step={1000}
                  value={band.amount}
                  aria-label={`${band.label} amount`}
                  onChange={(e) => actions.updateBand(band.id, Number(e.target.value) || 0)}
                />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
