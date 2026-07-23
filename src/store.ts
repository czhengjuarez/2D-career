import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { seedState, uid } from './seed';
import { ApiError, api, type SessionUser, type TeamSummary } from './api';
import type {
  AppState,
  Assessment,
  Capability,
  LeadershipDimension,
  Person,
  Track,
} from './types';

const STORAGE_KEY = '2d-career:v1';
const WORKSPACE_KEY = '2d-career:workspace';

/** 'local' keeps everything in this browser; anything else is a team id stored in R2. */
export type WorkspaceId = 'local' | (string & {});

function loadLocal(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const fallback = seedState();
    return {
      currency: parsed.currency ?? fallback.currency,
      tracks: parsed.tracks ?? fallback.tracks,
      leadership: parsed.leadership ?? fallback.leadership,
      people: parsed.people ?? [],
      assessments: parsed.assessments ?? [],
      bands: parsed.bands ?? fallback.bands,
    };
  } catch {
    return seedState();
  }
}

export interface Session {
  user: SessionUser | null;
  teams: TeamSummary[];
  signInEnabled: boolean;
}

export type SyncStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

export function useWorkspace() {
  const [session, setSession] = useState<Session | null>(null);
  const [workspaceId, setWorkspaceId] = useState<WorkspaceId>(
    () => localStorage.getItem(WORKSPACE_KEY) ?? 'local',
  );
  const [state, setState] = useState<AppState>(loadLocal);
  const [team, setTeam] = useState<TeamSummary | null>(null);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [notice, setNotice] = useState<string | null>(null);

  const versionRef = useRef(0);
  const versionSeenRef = useRef(0);
  const statusRef = useRef<SyncStatus>('idle');
  const skipSaveRef = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTeam = workspaceId !== 'local';

  const applyPayload = useCallback((payload: { team: TeamSummary; state: AppState }) => {
    skipSaveRef.current = true;
    versionRef.current = payload.team.stateVersion;
    versionSeenRef.current = payload.team.version;
    setTeam(payload.team);
    setState(payload.state);
  }, []);

  /**
   * Scores arrive without disturbing whatever the person is editing — only the
   * assessment list is taken from the server response.
   */
  /** Roster claims come back from the server; only the people list is taken. */
  const applyPeople = useCallback((payload: { team: TeamSummary; state: AppState }) => {
    skipSaveRef.current = true;
    versionSeenRef.current = payload.team.version;
    versionRef.current = payload.team.stateVersion;
    setTeam(payload.team);
    setState((current) => ({ ...current, people: payload.state.people }));
  }, []);

  const applyScores = useCallback((payload: { team: TeamSummary; state: AppState }) => {
    skipSaveRef.current = true;
    versionSeenRef.current = payload.team.version;
    setTeam(payload.team);
    setState((current) => ({ ...current, assessments: payload.state.assessments }));
  }, []);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Who is signed in, and which teams do they belong to.
  const refreshSession = useCallback(async () => {
    try {
      setSession(await api.me());
    } catch {
      setSession({ user: null, teams: [], signInEnabled: false });
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  // Load whichever workspace is selected.
  useEffect(() => {
    localStorage.setItem(WORKSPACE_KEY, workspaceId);
    if (!isTeam) {
      skipSaveRef.current = true;
      setTeam(null);
      setState(loadLocal());
      setStatus('idle');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    api
      .getTeam(workspaceId)
      .then((payload) => {
        if (cancelled) return;
        applyPayload(payload);
        setStatus('idle');
      })
      .catch((error: ApiError) => {
        if (cancelled) return;
        setNotice(error.message);
        setStatus('error');
        setWorkspaceId('local');
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, isTeam, applyPayload]);

  // Persist: localStorage immediately, team state on a short debounce.
  useEffect(() => {
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    if (!isTeam) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setStatus('saving');
    saveTimer.current = setTimeout(() => {
      api
        .saveState(workspaceId, state, versionRef.current)
        .then((payload) => {
          versionRef.current = payload.team.stateVersion;
          versionSeenRef.current = payload.team.version;
          setTeam(payload.team);
          setStatus('saved');
        })
        .catch((error: ApiError) => {
          if (error.status === 409) {
            const payload = error.payload as { team: TeamSummary; state: AppState };
            applyPayload(payload);
            setNotice('A teammate saved first — their version is now loaded.');
            setStatus('idle');
            return;
          }
          setNotice(error.message);
          setStatus('error');
        });
    }, 700);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, isTeam, workspaceId, applyPayload]);

  /**
   * Peer scoring happens in parallel, so a team workspace quietly checks for work done
   * by other people. Nothing is pulled in while there are unsaved edits on this screen.
   */
  useEffect(() => {
    if (!isTeam) return;
    const tick = () => {
      if (document.hidden || statusRef.current === 'saving' || statusRef.current === 'loading') {
        return;
      }
      api
        .getTeam(workspaceId)
        .then((payload) => {
          if (payload.team.version === versionSeenRef.current) return;
          versionSeenRef.current = payload.team.version;
          applyPayload(payload);
        })
        .catch(() => {
          /* a failed poll is not worth interrupting anyone over */
        });
    };
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, [isTeam, workspaceId, applyPayload]);

  const patch = useCallback((fn: (s: AppState) => AppState) => setState(fn), []);

  const actions = useMemo(
    () => ({
      setCurrency: (currency: string) => patch((s) => ({ ...s, currency })),

      addTrack: (name: string) =>
        patch((s) => ({
          ...s,
          tracks: [...s.tracks, { id: uid('trk'), name, summary: '', capabilities: [] }],
        })),
      updateTrack: (id: string, changes: Partial<Track>) =>
        patch((s) => ({
          ...s,
          tracks: s.tracks.map((t) => (t.id === id ? { ...t, ...changes } : t)),
        })),
      removeTrack: (id: string) =>
        patch((s) => ({
          ...s,
          tracks: s.tracks.filter((t) => t.id !== id),
          people: s.people.filter((p) => p.trackId !== id),
        })),

      addCapability: (trackId: string, name: string) =>
        patch((s) => ({
          ...s,
          tracks: s.tracks.map((t) =>
            t.id === trackId
              ? {
                  ...t,
                  capabilities: [
                    ...t.capabilities,
                    { id: uid('cap'), name, levels: { 1: '', 2: '', 3: '' } },
                  ],
                }
              : t,
          ),
        })),
      updateCapability: (trackId: string, capId: string, changes: Partial<Capability>) =>
        patch((s) => ({
          ...s,
          tracks: s.tracks.map((t) =>
            t.id === trackId
              ? {
                  ...t,
                  capabilities: t.capabilities.map((c) =>
                    c.id === capId ? { ...c, ...changes } : c,
                  ),
                }
              : t,
          ),
        })),
      removeCapability: (trackId: string, capId: string) =>
        patch((s) => ({
          ...s,
          tracks: s.tracks.map((t) =>
            t.id === trackId
              ? { ...t, capabilities: t.capabilities.filter((c) => c.id !== capId) }
              : t,
          ),
        })),

      addLeadership: (name: string) =>
        patch((s) => ({
          ...s,
          leadership: [...s.leadership, { id: uid('ld'), name, levels: { 1: '', 2: '', 3: '' } }],
        })),
      updateLeadership: (id: string, changes: Partial<LeadershipDimension>) =>
        patch((s) => ({
          ...s,
          leadership: s.leadership.map((l) => (l.id === id ? { ...l, ...changes } : l)),
        })),
      removeLeadership: (id: string) =>
        patch((s) => ({ ...s, leadership: s.leadership.filter((l) => l.id !== id) })),

      addPerson: (person: Omit<Person, 'id'>) =>
        patch((s) => ({ ...s, people: [...s.people, { ...person, id: uid('per') }] })),
      updatePerson: (id: string, changes: Partial<Person>) =>
        patch((s) => ({
          ...s,
          people: s.people.map((p) => (p.id === id ? { ...p, ...changes } : p)),
        })),
      removePerson: (id: string) =>
        patch((s) => ({
          ...s,
          people: s.people.filter((p) => p.id !== id),
          assessments: s.assessments.filter((a) => a.personId !== id),
        })),

      /** In a team, scores go straight to the server so two raters can never overwrite each other. */
      addAssessment: (assessment: Omit<Assessment, 'id'>) => {
        if (!isTeam) {
          patch((s) => ({
            ...s,
            assessments: [...s.assessments, { ...assessment, id: uid('asm') }],
          }));
          return;
        }
        setStatus('saving');
        api
          .addAssessment(workspaceId, assessment)
          .then((payload) => {
            applyScores(payload);
            setStatus('saved');
          })
          .catch((error: ApiError) => {
            setNotice(error.message);
            setStatus('error');
          });
      },
      removeAssessment: (id: string) => {
        if (!isTeam) {
          patch((s) => ({ ...s, assessments: s.assessments.filter((a) => a.id !== id) }));
          return;
        }
        setStatus('saving');
        api
          .removeAssessment(workspaceId, id)
          .then((payload) => {
            applyScores(payload);
            setStatus('saved');
          })
          .catch((error: ApiError) => {
            setNotice(error.message);
            setStatus('error');
          });
      },

      /** Point your account at a roster row — or at none, by passing null. */
      claimPerson: (personId: string | null) => {
        if (!isTeam) return;
        setStatus('saving');
        api
          .claimPerson(workspaceId, personId)
          .then((payload) => {
            applyPeople(payload);
            setStatus('saved');
          })
          .catch((error: ApiError) => {
            setNotice(error.message);
            setStatus('error');
          });
      },

      updateBand: (id: string, amount: number) =>
        patch((s) => ({ ...s, bands: s.bands.map((b) => (b.id === id ? { ...b, amount } : b)) })),

      replaceAll: (next: AppState) => setState(next),
      reset: () => setState(seedState()),
    }),
    [patch, isTeam, workspaceId, applyScores, applyPeople],
  );

  const workspace = useMemo(
    () => ({
      id: workspaceId,
      isTeam,
      team,
      status,
      notice,
      dismissNotice: () => setNotice(null),
      select: (id: WorkspaceId) => setWorkspaceId(id),
      refreshSession,
      applyPayload,
      signOut: async () => {
        await api.logout();
        setWorkspaceId('local');
        await refreshSession();
      },
    }),
    [workspaceId, isTeam, team, status, notice, refreshSession, applyPayload],
  );

  return { state, actions, session, workspace };
}

export type Actions = ReturnType<typeof useWorkspace>['actions'];
export type Workspace = ReturnType<typeof useWorkspace>['workspace'];
