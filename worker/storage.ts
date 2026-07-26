/// <reference types="@cloudflare/workers-types" />

import type { AppState } from '../src/types';
import { scorePerson, type PersonScore } from '../src/scoring';
import type { SessionUser } from './auth';

export interface StoredUser extends SessionUser {
  createdAt: string;
  teamIds: string[];
  /** Ids of personal access tokens this account has minted. */
  tokenIds?: string[];
}

/** One owner per team. Admins share every power except deleting the team itself. */
export type TeamRole = 'owner' | 'admin' | 'member';

export interface TeamMember {
  userId: string;
  name: string;
  email: string;
  picture: string;
  role: TeamRole;
  joinedAt: string;
}

/**
 * Who other than an admin gets to see individual scores. Admins and the owner always see
 * everything, regardless of this setting — it only throttles what regular members get.
 * Defaults to 'open', matching the app's behavior before this setting existed.
 */
export type ScoreVisibility = 'open' | 'anonymous' | 'averages';

export interface Team {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  members: TeamMember[];
  /** Bumped on every write of any kind. */
  version: number;
  /**
   * Bumped only when the framework itself changes. Membership changes and incoming
   * scores must not invalidate the copy someone is part-way through editing.
   */
  stateVersion: number;
  state: AppState;
  /** Missing on teams created before this setting existed — treat as 'open'. */
  scoreVisibility?: ScoreVisibility;
}

export const userKey = (id: string) => `users/${id}.json`;
/** Marker left behind by account deletion, so outstanding session cookies stop working. */
export const tombstoneKey = (id: string) => `deleted/${id}.json`;
export const teamKey = (id: string) => `teams/${id}.json`;
export const codeKey = (code: string) => `codes/${code.toUpperCase()}.json`;

export async function getJson<T>(bucket: R2Bucket, key: string): Promise<T | null> {
  const object = await bucket.get(key);
  if (!object) return null;
  return (await object.json()) as T;
}

export async function putJson(bucket: R2Bucket, key: string, value: unknown): Promise<void> {
  await bucket.put(key, JSON.stringify(value), {
    httpMetadata: { contentType: 'application/json' },
  });
}

/**
 * Read–modify–write against R2's conditional put. Two people submitting scores at the
 * same second must not silently overwrite each other, so a losing writer retries against
 * the fresh copy rather than clobbering it.
 */
export async function mutateTeam(
  bucket: R2Bucket,
  id: string,
  mutate: (team: Team) => Team | null,
  attempts = 4,
): Promise<Team | null> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const object = await bucket.get(teamKey(id));
    if (!object) return null;
    const team = (await object.json()) as Team;
    const next = mutate(team);
    if (!next) return null;
    next.version = team.version + 1;
    const written = await bucket.put(teamKey(id), JSON.stringify(next), {
      httpMetadata: { contentType: 'application/json' },
      onlyIf: { etagMatches: object.etag },
    });
    if (written) return next;
  }
  throw new Error('conflict');
}

export function isMember(team: Team, userId: string): boolean {
  return team.members.some((member) => member.userId === userId);
}

export function roleOf(team: Team, userId: string): TeamRole | null {
  return team.members.find((member) => member.userId === userId)?.role ?? null;
}

export function isAdmin(team: Team, userId: string): boolean {
  const role = roleOf(team, userId);
  return role === 'owner' || role === 'admin';
}

/** Metadata a client is allowed to see about a team — membership, not its scores. */
export function teamSummary(team: Team) {
  return {
    id: team.id,
    name: team.name,
    code: team.code,
    members: team.members,
    version: team.version,
    stateVersion: team.stateVersion,
    scoreVisibility: team.scoreVisibility ?? 'open',
  };
}

/**
 * What a given viewer's copy of the team's scores looks like — the one place this
 * decision is made, so every route that returns state goes through it. Admins and the
 * owner always get the true, unredacted assessments. A regular member gets:
 *   - 'open'      the same, unredacted list (today's default behaviour)
 *   - 'anonymous' every score, but with the rater's identity stripped
 *   - 'averages'  no individual scores at all
 * `summaries` is always the full, aggregate-only PersonScore for every person — grades and
 * bands never depend on seeing who scored whom, so it is sent regardless of the setting
 * above and lets the Matrix and People views render without needing raw assessments.
 */
export function teamResponsePayload(team: Team, viewerId: string) {
  const state = team.state;
  const summaries: PersonScore[] = state.people.map((person) => scorePerson(state, person));

  if (isAdmin(team, viewerId)) {
    return { team: teamSummary(team), state, summaries };
  }

  const visibility = team.scoreVisibility ?? 'open';
  if (visibility === 'open') {
    return { team: teamSummary(team), state, summaries };
  }

  if (visibility === 'anonymous') {
    return {
      team: teamSummary(team),
      state: {
        ...state,
        assessments: state.assessments.map((a) => ({
          ...a,
          rater: 'Team member',
          raterId: undefined,
        })),
      },
      summaries,
    };
  }

  // 'averages' — the roster still shows every grade (via summaries), just no per-score detail.
  return { team: teamSummary(team), state: { ...state, assessments: [] }, summaries };
}
