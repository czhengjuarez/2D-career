export type SkillLevel = 1 | 2 | 3; // 1 = A, 2 = B, 3 = C
export type LeadershipLevel = 1 | 2 | 3;
export type SkillLetter = 'A' | 'B' | 'C';

/** "1A" … "3C" — leadership digit + skill letter, as in the Remuneration Diamond. */
export type Grade = `${LeadershipLevel}${SkillLetter}`;

export interface LevelDescriptors {
  1: string;
  2: string;
  3: string;
}

export interface Capability {
  id: string;
  name: string;
  /** What A / B / C look like for this specific capability. */
  levels: LevelDescriptors;
}

export interface Track {
  id: string;
  name: string;
  summary: string;
  capabilities: Capability[];
}

/** Leadership dimensions are org-wide — the same ladder for everyone, by design. */
export interface LeadershipDimension {
  id: string;
  name: string;
  levels: LevelDescriptors;
}

export interface Person {
  id: string;
  name: string;
  role: string;
  trackId: string;
  /** Team workspaces only: the signed-in account this roster row belongs to. */
  accountId?: string;
}

export interface Assessment {
  id: string;
  personId: string;
  rater: string;
  /** Set by the server for team scores — the signed-in account that submitted it. */
  raterId?: string;
  kind: 'self' | 'peer';
  date: string;
  /** capabilityId → 1|2|3 */
  skills: Record<string, SkillLevel>;
  /** dimensionId → 1|2|3 */
  leadership: Record<string, LeadershipLevel>;
  note: string;
}

export interface PayBand {
  id: string;
  /** Grades that share this band, e.g. ["1C", "2B", "3A"]. */
  grades: Grade[];
  amount: number;
  label: string;
}

export interface AppState {
  currency: string;
  tracks: Track[];
  leadership: LeadershipDimension[];
  people: Person[];
  assessments: Assessment[];
  bands: PayBand[];
}
