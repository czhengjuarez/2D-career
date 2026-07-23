import { useId, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { CURRENCY_PRESETS, LEADERSHIP_AXIS, LETTERS, SKILL_AXIS } from '../scoring';
import type { LevelDescriptors } from '../types';

export function PageHead({
  title,
  children,
  aside,
}: {
  title: string;
  children?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="page-head row row--top">
      <div style={{ flex: 1, minWidth: 260 }}>
        <h2>{title}</h2>
        {children ? <p>{children}</p> : null}
      </div>
      {aside}
    </header>
  );
}

export function DeleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="icon-btn" aria-label={label} title={label} onClick={onClick}>
      <Trash2 size={16} strokeWidth={1.75} />
    </button>
  );
}

/** The A/B/C or 1/2/3 picker used everywhere a level is chosen. */
export function LevelPicker({
  axis,
  descriptors,
  value,
  onChange,
  name,
}: {
  axis: 'skill' | 'leadership';
  descriptors: LevelDescriptors;
  value: 1 | 2 | 3 | undefined;
  onChange: (level: 1 | 2 | 3) => void;
  name: string;
}) {
  const levels: (1 | 2 | 3)[] = [1, 2, 3];
  return (
    <div className="levels" role="group" aria-label={`${name} level`}>
      {levels.map((level) => {
        const key = axis === 'skill' ? LETTERS[level - 1] : String(level);
        const fallback =
          axis === 'skill'
            ? SKILL_AXIS[LETTERS[level - 1]].blurb
            : LEADERSHIP_AXIS[level].blurb;
        return (
          <button
            key={level}
            type="button"
            className="level"
            aria-pressed={value === level}
            onClick={() => onChange(level)}
          >
            <span className="level__key">
              {key} · {axis === 'skill' ? SKILL_AXIS[LETTERS[level - 1]].title : LEADERSHIP_AXIS[level].title}
            </span>
            <span className="level__text">{descriptors[level]?.trim() || fallback}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Free-text currency with common presets — no assumption about which one you use. */
export function CurrencyField({
  value,
  onChange,
  label = 'Currency',
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const id = useId();
  const current = value.trim();
  return (
    <div className="of-field" style={{ maxWidth: 340 }}>
      <label className="of-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="of-input"
        style={{ maxWidth: 180 }}
        value={value}
        placeholder="Any symbol or code"
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="currency-presets" role="group" aria-label="Common currencies">
        {CURRENCY_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className="currency-chip"
            aria-pressed={current === preset}
            onClick={() => onChange(preset)}
          >
            {preset}
          </button>
        ))}
        <button
          type="button"
          className="currency-chip"
          aria-pressed={current === ''}
          onClick={() => onChange('')}
        >
          none
        </button>
      </div>
      <span className="of-field__hint">
        Type your own, or pick one. "none" shows plain numbers with no unit.
      </span>
    </div>
  );
}

export function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return <span className="of-badge of-badge--default">Not scored</span>;
  return <span className="of-badge of-badge--purple mono">{grade}</span>;
}

export function Meter({ value }: { value: number | null }) {
  const pct = value == null ? 0 : ((value - 1) / 2) * 100;
  return (
    <div className="meter" role="presentation">
      <div className="meter__fill" style={{ width: `${Math.max(4, pct)}%` }} />
    </div>
  );
}
