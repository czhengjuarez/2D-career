import { useRef, useState } from 'react';
import {
  Cloud,
  CloudOff,
  Download,
  FileJson,
  Grid3x3,
  ListChecks,
  RotateCcw,
  Upload,
  UserRound,
  Users,
  Wrench,
} from 'lucide-react';
import { useWorkspace } from './store';
import type { AppState } from './types';
import { buildTemplate, downloadJson } from './template';
import { ThemeToggle } from './components/ThemeToggle';
import { ProfileMenu } from './components/ProfileMenu';
import { HomeView } from './views/HomeView';
import { MatrixView } from './views/MatrixView';
import { FrameworkView } from './views/FrameworkView';
import { AssessView } from './views/AssessView';
import { PeopleView } from './views/PeopleView';
import { TeamView } from './views/TeamView';

type TabId = 'home' | 'matrix' | 'framework' | 'assess' | 'people' | 'team';

const TABS: { id: Exclude<TabId, 'home'>; label: string; icon: typeof Grid3x3 }[] = [
  { id: 'matrix', label: 'Matrix', icon: Grid3x3 },
  { id: 'framework', label: 'Framework', icon: Wrench },
  { id: 'assess', label: 'Assess', icon: ListChecks },
  { id: 'people', label: 'People', icon: Users },
  { id: 'team', label: 'Team', icon: UserRound },
];

const SYNC_LABEL: Record<string, string> = {
  loading: 'Loading…',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Not saved',
  idle: 'Synced',
};

export default function App() {
  const { state, actions, session, workspace } = useWorkspace();
  const [tab, setTab] = useState<TabId>('home');
  const myRole = workspace.team?.members.find((m) => m.userId === session?.user?.id)?.role;
  const adminOfCurrentTeam = myRole === 'owner' || myRole === 'admin';
  const myPersonId =
    (workspace.isTeam && session?.user
      ? state.people.find((person) => person.accountId === session.user!.id)?.id
      : null) ?? null;
  const fileInput = useRef<HTMLInputElement>(null);

  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as AppState;
      if (!parsed.tracks || !parsed.bands) throw new Error('unrecognised file');
      actions.replaceAll({
        ...parsed,
        people: parsed.people ?? [],
        assessments: workspace.isTeam ? state.assessments : (parsed.assessments ?? []),
      });
      setTab('framework');
    } catch {
      alert(
        'That file does not look like a career framework. It needs at least "tracks" and "bands" — download the Template for a working example.',
      );
    }
  };

  return (
    <div className="app">
      <header className="masthead">
        <div className="shell masthead__inner">
          <button
            type="button"
            className="masthead__home"
            onClick={() => setTab('home')}
            aria-label="Go to home"
            aria-current={tab === 'home' ? 'page' : undefined}
          >
            <span className="masthead__mark" aria-hidden>
              2D
            </span>
            <span>
              <span className="masthead__title">Career framework</span>
              <span className="masthead__sub">
                {workspace.isTeam && workspace.team
                  ? `${workspace.team.name} · ${workspace.team.members.length} member${
                      workspace.team.members.length === 1 ? '' : 's'
                    }`
                  : 'This browser only — not shared'}
              </span>
            </span>
          </button>
          <span className="spacer" />

          <span
            className={`sync sync--${workspace.status}`}
            title={
              workspace.isTeam
                ? 'Changes are saved to your team'
                : 'Changes are saved in this browser only'
            }
          >
            {workspace.isTeam ? (
              <Cloud size={14} strokeWidth={1.75} />
            ) : (
              <CloudOff size={14} strokeWidth={1.75} />
            )}
            {workspace.isTeam ? (SYNC_LABEL[workspace.status] ?? 'Synced') : 'Local'}
          </span>

          <button
            type="button"
            className="of-btn of-btn--ghost of-btn--sm"
            onClick={() => downloadJson(state, 'career-framework.json')}
          >
            <Download size={16} strokeWidth={1.75} />
            Export
          </button>
          <button
            type="button"
            className="of-btn of-btn--ghost of-btn--sm"
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={16} strokeWidth={1.75} />
            Import
          </button>
          <button
            type="button"
            className="of-btn of-btn--ghost of-btn--sm"
            title="Download a blank framework file you can fill in and import"
            onClick={() => downloadJson(buildTemplate(), 'career-framework-template.json')}
          >
            <FileJson size={16} strokeWidth={1.75} />
            Template
          </button>
          {!workspace.isTeam ? (
            <button
              type="button"
              className="of-btn of-btn--ghost of-btn--sm"
              onClick={() => {
                if (confirm('Reset to the seeded example framework? All people and scores are lost.'))
                  actions.reset();
              }}
            >
              <RotateCcw size={16} strokeWidth={1.75} />
              Reset
            </button>
          ) : null}

          <ThemeToggle />

          {session?.user ? (
            <ProfileMenu
              user={session.user}
              onSignOut={() => void workspace.signOut()}
              onDeleted={() => {
                workspace.select('local');
                void workspace.refreshSession();
              }}
            />
          ) : session?.signInEnabled ? (
            <a className="of-btn of-btn--primary of-btn--sm" href="/auth/google">
              Sign in
            </a>
          ) : null}

          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importJson(file);
              e.target.value = '';
            }}
          />
        </div>
      </header>

      <div className="tabs-bar">
        <div className="shell">
          <div className="tabs" role="tablist" aria-label="Sections">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`panel-${id}`}
                className="tab"
                onClick={() => setTab(id)}
              >
                <Icon size={16} strokeWidth={1.75} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {workspace.notice ? (
        <div className="shell" style={{ paddingTop: 'var(--of-space-4)' }}>
          <div className="notice">
            <span>{workspace.notice}</span>
            <button type="button" className="of-btn of-btn--ghost of-btn--sm" onClick={workspace.dismissNotice}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <main>
        <div
          className="shell"
          role="tabpanel"
          id={`panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          tabIndex={-1}
        >
          {tab === 'home' && (
            <HomeView
              state={state}
              actions={actions}
              onNavigate={(next) => setTab(next)}
              signedIn={Boolean(session?.user)}
              signInEnabled={Boolean(session?.signInEnabled)}
            />
          )}
          {tab === 'matrix' && <MatrixView state={state} actions={actions} />}
          {tab === 'framework' && <FrameworkView state={state} actions={actions} />}
          {tab === 'assess' && (
            <AssessView
              state={state}
              actions={actions}
              identity={workspace.isTeam ? (session?.user?.name ?? null) : null}
              myPersonId={myPersonId}
              onDone={() => setTab('people')}
            />
          )}
          {tab === 'people' && (
            <PeopleView
              state={state}
              actions={actions}
              viewer={{
                userId: session?.user?.id ?? null,
                isAdmin: adminOfCurrentTeam,
                isTeam: workspace.isTeam,
              }}
            />
          )}
          {tab === 'team' && (
            <TeamView session={session} workspace={workspace} onLoaded={() => setTab('matrix')} />
          )}
        </div>
      </main>
    </div>
  );
}
