import { useState } from 'react';
import { Cloud, CloudOff, Coins, ListChecks, UserRound, Users, Wrench } from 'lucide-react';
import { useWorkspace } from './store';
import { ThemeToggle } from './components/ThemeToggle';
import { ProfileMenu } from './components/ProfileMenu';
import { HomeView } from './views/HomeView';
import { PaybandView } from './views/PaybandView';
import { FrameworkView } from './views/FrameworkView';
import { AssessView } from './views/AssessView';
import { PeopleView } from './views/PeopleView';
import { TeamView } from './views/TeamView';

type TabId = 'home' | 'payband' | 'framework' | 'assess' | 'people' | 'team';

/** Evaluation tabs first (daily use); Org Payband last and visually set apart — a
 *  separate concern, not another step in the same flow. See app-shell.css .tabs__divider. */
const TABS: { id: Exclude<TabId, 'home'>; label: string; icon: typeof Coins }[] = [
  { id: 'team', label: 'Team', icon: UserRound },
  { id: 'framework', label: 'Framework', icon: Wrench },
  { id: 'assess', label: 'Assess', icon: ListChecks },
  { id: 'people', label: 'People', icon: Users },
  { id: 'payband', label: 'Org Payband', icon: Coins },
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
        </div>
      </header>

      <div className="tabs-bar">
        <div className="shell">
          <div className="tabs" role="tablist" aria-label="Sections">
            {TABS.map(({ id, label, icon: Icon }, index) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`panel-${id}`}
                className={`tab${index === TABS.length - 1 ? ' tab--set-apart' : ''}`}
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
              onNavigate={(next) => setTab(next)}
              signedIn={Boolean(session?.user)}
              signInEnabled={Boolean(session?.signInEnabled)}
            />
          )}
          {tab === 'payband' && <PaybandView state={state} actions={actions} />}
          {tab === 'framework' && (
            <FrameworkView state={state} actions={actions} isTeam={workspace.isTeam} />
          )}
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
              summaries={workspace.summaries}
            />
          )}
          {tab === 'team' && (
            <TeamView
              session={session}
              workspace={workspace}
              actions={actions}
              onLoaded={() => setTab('people')}
            />
          )}
        </div>
      </main>
    </div>
  );
}
