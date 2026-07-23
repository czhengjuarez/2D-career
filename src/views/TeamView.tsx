import { useState } from 'react';
import { Check, Copy, LogOut, RefreshCw, ShieldCheck, Trash2, UserMinus, Users } from 'lucide-react';
import { ApiError, api, type TeamRole } from '../api';
import type { Session, Workspace } from '../store';
import { PageHead } from '../components/ui';
import { TokenPanel } from '../components/TokenPanel';

export function TeamView({
  session,
  workspace,
  onLoaded,
}: {
  session: Session | null;
  workspace: Workspace;
  onLoaded: () => void;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [rename, setRename] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const run = async (task: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
      await workspace.refreshSession();
    } catch (thrown) {
      setError(thrown instanceof ApiError ? thrown.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  if (!session) {
    return (
      <div className="stack">
        <PageHead title="Team" />
        <div className="empty">Checking your session…</div>
      </div>
    );
  }

  if (!session.user) {
    return (
      <div className="stack">
        <PageHead title="Team">
          A framework takes a while to fill in, and peer scoring only works when several people
          score the same person. Sign in to keep your work on the server and share it with
          colleagues.
        </PageHead>
        <article className="of-card">
          <h3>Sign in with Google</h3>
          <p className="muted" style={{ marginTop: 'var(--of-space-2)' }}>
            You stay in the local workspace until you choose a team, so nothing you have already
            written in this browser is lost.
          </p>
          <div className="row" style={{ marginTop: 'var(--of-space-4)' }}>
            {session.signInEnabled ? (
              <a className="of-btn of-btn--primary of-btn--md" href="/auth/google">
                Continue with Google
              </a>
            ) : (
              <span className="of-badge of-badge--amber">
                Sign-in is not configured on this deployment
              </span>
            )}
          </div>
        </article>
        <article className="of-card">
          <h3>What changes when you sign in</h3>
          <div className="stack stack--tight" style={{ marginTop: 'var(--of-space-3)' }}>
            <p className="muted">
              <strong>Your team shares one framework.</strong> Tracks, capabilities, people and pay
              bands live in one place, and everyone edits the same copy.
            </p>
            <p className="muted">
              <strong>Scores are attributed and visible.</strong> Every score carries the name of
              the person who gave it, and every team member can see them. That is a deliberate
              choice — it works when the team has already agreed to it, and badly when it has not.
            </p>
            <p className="muted">
              <strong>The local workspace stays.</strong> You can switch back at any time to sketch
              a framework privately before bringing it to the team.
            </p>
          </div>
        </article>
      </div>
    );
  }

  const team = workspace.team;
  const myRole = team?.members.find((m) => m.userId === session.user?.id)?.role;
  const isOwner = myRole === 'owner';
  const isAdmin = myRole === 'owner' || myRole === 'admin';

  return (
    <div className="stack">
      <PageHead title="Team">
        Signed in as {session.user.name}. Anyone with the join code can enter the team and see
        everything in it, including every individual score.
      </PageHead>

      {error ? <div className="of-card notice notice--error">{error}</div> : null}

      <section className="stack stack--tight">
        <h3 className="section-title">Your workspaces</h3>
        <div className="list">
          <button
            type="button"
            className={`list-row workspace${workspace.id === 'local' ? ' workspace--active' : ''}`}
            onClick={() => {
              workspace.select('local');
              onLoaded();
            }}
          >
            <div className="list-row__main">
              <div className="list-row__name">This browser only</div>
              <div className="text-xs muted">Private, stored on this device, never uploaded</div>
            </div>
            {workspace.id === 'local' ? (
              <span className="of-badge of-badge--green">Open</span>
            ) : null}
          </button>
          {session.teams.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`list-row workspace${workspace.id === entry.id ? ' workspace--active' : ''}`}
              onClick={() => {
                workspace.select(entry.id);
                onLoaded();
              }}
            >
              <div className="list-row__main">
                <div className="list-row__name">{entry.name}</div>
                <div className="text-xs muted">
                  {entry.members.length} member{entry.members.length === 1 ? '' : 's'} · code{' '}
                  <span className="mono">{entry.code}</span>
                </div>
              </div>
              {workspace.id === entry.id ? (
                <span className="of-badge of-badge--green">Open</span>
              ) : null}
            </button>
          ))}
        </div>
      </section>

      {team && workspace.isTeam ? (
        <section className="of-card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3>{team.name}</h3>
            <span className="of-badge of-badge--blue">
              <Users size={13} strokeWidth={1.75} /> {team.members.length}
            </span>
          </div>

          <div className="join-code">
            <div>
              <div className="section-title">Join code</div>
              <div className="join-code__value mono">{team.code}</div>
            </div>
            <div className="row">
              <button
                type="button"
                className="of-btn of-btn--secondary of-btn--sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(team.code);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check size={15} strokeWidth={1.75} /> : <Copy size={15} strokeWidth={1.75} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              {isAdmin ? (
                <button
                  type="button"
                  className="of-btn of-btn--ghost of-btn--sm"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const payload = await api.rotateCode(team.id);
                      workspace.applyPayload(payload);
                    })
                  }
                >
                  <RefreshCw size={15} strokeWidth={1.75} />
                  New code
                </button>
              ) : null}
            </div>
          </div>

          <div className="section-title" style={{ marginTop: 'var(--of-space-5)' }}>
            Members
          </div>
          <div className="list" style={{ marginTop: 'var(--of-space-2)' }}>
            {team.members.map((member) => {
              const isSelf = member.userId === session.user?.id;
              const canChangeRole = isOwner && !isSelf;
              const canRemove =
                isAdmin && !isSelf && member.role !== 'owner' && (isOwner || member.role === 'member');
              return (
                <div key={member.userId} className="list-row">
                  <div className="list-row__main">
                    <div className="list-row__name">
                      {member.name}
                      {isSelf ? <span className="muted" style={{ fontWeight: 400 }}> · you</span> : null}
                    </div>
                    <div className="text-xs muted">{member.email}</div>
                  </div>
                  {canChangeRole ? (
                    <select
                      className="of-select"
                      style={{ maxWidth: 130 }}
                      value={member.role}
                      aria-label={`Role for ${member.name}`}
                      disabled={busy}
                      onChange={(e) => {
                        const role = e.target.value as TeamRole;
                        if (
                          role === 'owner' &&
                          !confirm(
                            `Hand ownership of ${team.name} to ${member.name}? You become an admin.`,
                          )
                        )
                          return;
                        void run(async () => {
                          const payload = await api.setRole(team.id, member.userId, role);
                          workspace.applyPayload(payload);
                        });
                      }}
                    >
                      <option value="member">member</option>
                      <option value="admin">admin</option>
                      <option value="owner">owner</option>
                    </select>
                  ) : (
                    <span
                      className={`of-badge of-badge--${
                        member.role === 'owner' ? 'purple' : member.role === 'admin' ? 'blue' : 'default'
                      }`}
                    >
                      {member.role}
                    </span>
                  )}
                  {canRemove ? (
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Remove ${member.name}`}
                      title={`Remove ${member.name} from the team`}
                      disabled={busy}
                      onClick={() => {
                        if (
                          !confirm(
                            `Remove ${member.name} from ${team.name}? Scores they submitted stay, so nobody's grade changes.`,
                          )
                        )
                          return;
                        void run(async () => {
                          const payload = await api.removeMember(team.id, member.userId);
                          workspace.applyPayload(payload);
                        });
                      }}
                    >
                      <UserMinus size={16} strokeWidth={1.75} />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>

          {isAdmin ? (
            <div className="admin-panel">
              <div className="section-title">
                <ShieldCheck size={13} strokeWidth={1.75} /> Admin
              </div>
              <p className="text-xs muted" style={{ marginTop: 'var(--of-space-2)' }}>
                Admins rename the team, change the join code, remove members and delete anyone's
                score. Only the owner assigns roles or deletes the team.
              </p>
              <div className="row" style={{ marginTop: 'var(--of-space-3)' }}>
                <input
                  className="of-input"
                  style={{ flex: 1, minWidth: 180 }}
                  value={rename}
                  placeholder={team.name}
                  aria-label="Team name"
                  onChange={(e) => setRename(e.target.value)}
                />
                <button
                  type="button"
                  className="of-btn of-btn--secondary of-btn--sm"
                  disabled={busy || !rename.trim() || rename.trim() === team.name}
                  onClick={() =>
                    run(async () => {
                      const payload = await api.renameTeam(team.id, rename.trim());
                      workspace.applyPayload(payload);
                      setRename('');
                    })
                  }
                >
                  Rename
                </button>
              </div>
            </div>
          ) : null}

          <div className="row" style={{ marginTop: 'var(--of-space-5)' }}>
            {!isOwner ? (
              <button
                type="button"
                className="of-btn of-btn--ghost of-btn--sm"
                disabled={busy}
                onClick={() => {
                  if (!confirm(`Leave ${team.name}? The team keeps its framework and your scores.`))
                    return;
                  void run(async () => {
                    await api.leaveTeam(team.id);
                    workspace.select('local');
                  });
                }}
              >
                <LogOut size={15} strokeWidth={1.75} />
                Leave team
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="of-btn of-btn--danger of-btn--sm"
                  disabled={busy}
                  onClick={() => {
                    const typed = prompt(
                      `Deleting ${team.name} erases its framework, its people and every score for all ${team.members.length} members. This cannot be undone.\n\nType the team name to confirm:`,
                    );
                    if (typed !== team.name) return;
                    void run(async () => {
                      await api.deleteTeam(team.id);
                      workspace.select('local');
                    });
                  }}
                >
                  <Trash2 size={15} strokeWidth={1.75} />
                  Delete team
                </button>
                <span className="text-xs subtle">
                  As owner you cannot leave — hand ownership over first, or delete the team.
                </span>
              </>
            )}
          </div>
        </section>
      ) : null}

      <TokenPanel />

      <div className="grid-2">
        <article className="of-card">
          <h3>Start a team</h3>
          <p className="muted" style={{ marginTop: 'var(--of-space-2)' }}>
            You get a fresh framework seeded with the example tracks, and a code to hand to
            colleagues.
          </p>
          <div className="row" style={{ marginTop: 'var(--of-space-4)' }}>
            <input
              className="of-input"
              style={{ flex: 1, minWidth: 180 }}
              placeholder="Team or company name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button
              type="button"
              className="of-btn of-btn--primary of-btn--md"
              disabled={busy || !name.trim()}
              onClick={() =>
                run(async () => {
                  const payload = await api.createTeam(name.trim());
                  setName('');
                  workspace.select(payload.team.id);
                  onLoaded();
                })
              }
            >
              Create
            </button>
          </div>
        </article>

        <article className="of-card">
          <h3>Join a team</h3>
          <p className="muted" style={{ marginTop: 'var(--of-space-2)' }}>
            Enter the code a colleague gave you. You will see their framework, their people and
            every score already submitted.
          </p>
          <div className="row" style={{ marginTop: 'var(--of-space-4)' }}>
            <input
              className="of-input mono"
              style={{ flex: 1, minWidth: 140, textTransform: 'uppercase' }}
              placeholder="ABC234"
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <button
              type="button"
              className="of-btn of-btn--secondary of-btn--md"
              disabled={busy || !code.trim()}
              onClick={() =>
                run(async () => {
                  const payload = await api.joinTeam(code.trim());
                  setCode('');
                  workspace.select(payload.team.id);
                  onLoaded();
                })
              }
            >
              Join
            </button>
          </div>
        </article>
      </div>
    </div>
  );
}
