import type { AppState, Assessment } from './types';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  picture: string;
}

export type TeamRole = 'owner' | 'admin' | 'member';

export interface TeamMember {
  userId: string;
  name: string;
  email: string;
  picture: string;
  role: TeamRole;
  joinedAt: string;
}

export interface TeamSummary {
  id: string;
  name: string;
  code: string;
  members: TeamMember[];
  version: number;
  stateVersion: number;
}

export interface AccessToken {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface TeamPayload {
  team: TeamSummary;
  state: AppState;
}

export class ApiError extends Error {
  status: number;
  payload?: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (body as { error?: string }).error ?? 'Something went wrong.';
    throw new ApiError(message, response.status, body);
  }
  return body as T;
}

export const api = {
  me: () =>
    call<{ user: SessionUser | null; teams: TeamSummary[]; signInEnabled: boolean }>('/api/me'),

  logout: () => fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' }),

  deleteAccount: () => call<{ ok: true }>('/api/me', { method: 'DELETE' }),

  createTeam: (name: string) =>
    call<TeamPayload>('/api/teams', { method: 'POST', body: JSON.stringify({ name }) }),

  joinTeam: (code: string) =>
    call<TeamPayload>('/api/teams/join', { method: 'POST', body: JSON.stringify({ code }) }),

  getTeam: (id: string) => call<TeamPayload>(`/api/teams/${id}`),

  saveState: (id: string, state: AppState, version: number) =>
    call<TeamPayload>(`/api/teams/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ state, version }),
    }),

  addAssessment: (id: string, assessment: Omit<Assessment, 'id'>) =>
    call<TeamPayload>(`/api/teams/${id}/assessments`, {
      method: 'POST',
      body: JSON.stringify({ assessment }),
    }),

  removeAssessment: (id: string, assessmentId: string) =>
    call<TeamPayload>(`/api/teams/${id}/assessments/${assessmentId}`, { method: 'DELETE' }),

  listTokens: () => call<{ tokens: AccessToken[] }>('/api/tokens'),

  createToken: (name: string) =>
    call<{ token: AccessToken; secret: string }>('/api/tokens', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  revokeToken: (id: string) => call<{ ok: true }>(`/api/tokens/${id}`, { method: 'DELETE' }),

  claimPerson: (id: string, personId: string | null) =>
    call<TeamPayload>(`/api/teams/${id}/claim`, {
      method: 'POST',
      body: JSON.stringify({ personId }),
    }),

  renameTeam: (id: string, name: string) =>
    call<TeamPayload>(`/api/teams/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),

  setRole: (id: string, userId: string, role: TeamRole) =>
    call<TeamPayload>(`/api/teams/${id}/members/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),

  removeMember: (id: string, userId: string) =>
    call<TeamPayload>(`/api/teams/${id}/members/${userId}`, { method: 'DELETE' }),

  deleteTeam: (id: string) => call<{ ok: true }>(`/api/teams/${id}`, { method: 'DELETE' }),

  rotateCode: (id: string) => call<TeamPayload>(`/api/teams/${id}/code`, { method: 'POST' }),

  leaveTeam: (id: string) => call<{ ok: true }>(`/api/teams/${id}/leave`, { method: 'POST' }),
};
