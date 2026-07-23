import type {
  AppState,
  Assessment,
  Grade,
  LeadershipLevel,
  Person,
  SkillLetter,
  Track,
} from './types';

export const LETTERS: SkillLetter[] = ['A', 'B', 'C'];

export const SKILL_AXIS: Record<SkillLetter, { title: string; blurb: string }> = {
  A: {
    title: 'Foundational',
    blurb: 'Foundational skills for the job, works with lower complexity. Typically 1–5 years.',
  },
  B: {
    title: 'Developed',
    blurb: 'Developed skills for the job, works with moderate complexity. Typically 5+ years.',
  },
  C: {
    title: 'Advanced',
    blurb: 'Advanced skills for the job, works with high complexity. Typically 10+ years.',
  },
};

export const LEADERSHIP_AXIS: Record<LeadershipLevel, { title: string; blurb: string }> = {
  1: { title: 'Self', blurb: 'Takes responsibility for own contributions to outcomes.' },
  2: {
    title: 'Team',
    blurb: "Takes responsibility for both their own and the team's contributions.",
  },
  3: { title: 'Organisation', blurb: 'Takes responsibility for organisational outcomes.' },
};

export function letterFor(value: number): SkillLetter {
  return LETTERS[Math.min(2, Math.max(0, Math.round(value) - 1))];
}

export function leadershipFor(value: number): LeadershipLevel {
  return Math.min(3, Math.max(1, Math.round(value))) as LeadershipLevel;
}

export function gradeOf(skill: number, leadership: number): Grade {
  return `${leadershipFor(leadership)}${letterFor(skill)}` as Grade;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export interface ScoredAssessment {
  assessment: Assessment;
  skill: number | null;
  leadership: number | null;
}

/** One assessment → a point on the matrix (unrounded, so drift is visible). */
export function scoreAssessment(assessment: Assessment): ScoredAssessment {
  return {
    assessment,
    skill: mean(Object.values(assessment.skills)),
    leadership: mean(Object.values(assessment.leadership)),
  };
}

export interface PersonScore {
  person: Person;
  track: Track | undefined;
  /** Peer assessments only — self-assessment is shown, never counted. */
  peerCount: number;
  selfSkill: number | null;
  selfLeadership: number | null;
  skill: number | null;
  leadership: number | null;
  grade: Grade | null;
  /** Highest minus lowest peer grade position — a proxy for how much peers disagree. */
  spread: number | null;
  /** An axis average sits on a level boundary, so the rounded grade is a coin toss. */
  borderline: boolean;
}

/** Within 0.1 of the midpoint between two levels — e.g. 2.48 or 1.53. */
function onBoundary(value: number | null): boolean {
  if (value == null) return false;
  return Math.abs(((value % 1) + 1) % 1 - 0.5) < 0.1;
}

export function scorePerson(state: AppState, person: Person): PersonScore {
  const own = state.assessments.filter((a) => a.personId === person.id);
  const peers = own.filter((a) => a.kind === 'peer').map(scoreAssessment);
  const self = own.find((a) => a.kind === 'self');
  const selfScored = self ? scoreAssessment(self) : null;

  const skill = mean(peers.map((p) => p.skill).filter((v): v is number => v != null));
  const leadership = mean(peers.map((p) => p.leadership).filter((v): v is number => v != null));

  const combined = peers
    .map((p) => (p.skill ?? 0) + (p.leadership ?? 0))
    .filter((v) => v > 0);
  const spread = combined.length > 1 ? Math.max(...combined) - Math.min(...combined) : null;

  return {
    person,
    track: state.tracks.find((t) => t.id === person.trackId),
    peerCount: peers.length,
    selfSkill: selfScored?.skill ?? null,
    selfLeadership: selfScored?.leadership ?? null,
    skill,
    leadership,
    grade: skill != null && leadership != null ? gradeOf(skill, leadership) : null,
    spread,
    borderline: onBoundary(skill) || onBoundary(leadership),
  };
}

export function bandFor(state: AppState, grade: Grade | null): AppState['bands'][number] | undefined {
  if (!grade) return undefined;
  return state.bands.find((b) => b.grades.includes(grade));
}

/**
 * Currency is free text — a symbol (€, $, £, ¥), a code (CHF, SEK, PLN), or nothing at all
 * for organisations that would rather show bare numbers. Codes get a space, symbols don't.
 */
export function formatMoney(amount: number, currency: string): string {
  const value = amount.toLocaleString('en-US');
  const unit = currency.trim();
  if (!unit) return value;
  return /^[\p{L}]{2,}$/u.test(unit) ? `${unit} ${value}` : `${unit}${value}`;
}

export const CURRENCY_PRESETS = ['€', '$', '£', '¥', '₹', 'R$', 'kr', 'CHF', 'PLN', 'AED'];
