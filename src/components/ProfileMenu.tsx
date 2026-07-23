import { useEffect, useRef, useState } from 'react';
import { LogOut, Trash2 } from 'lucide-react';
import { ApiError, api, type SessionUser } from '../api';

export function ProfileMenu({
  user,
  onSignOut,
  onDeleted,
}: {
  user: SessionUser;
  onSignOut: () => void;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const deleteAccount = async () => {
    const typed = prompt(
      'Deleting your account removes your sign-in, your API tokens and your place in every team.\n\n' +
        'Scores you gave are kept so nobody\'s grade changes, but your name is removed from them. Teams you own pass to another member, or are deleted if you are the only one.\n\n' +
        'Type DELETE to confirm:',
    );
    if (typed !== 'DELETE') return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteAccount();
      onDeleted();
    } catch (thrown) {
      setError(thrown instanceof ApiError ? thrown.message : 'Could not delete the account.');
      setBusy(false);
    }
  };

  return (
    <div className="profile" ref={wrapper}>
      <button
        type="button"
        className="account"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {user.picture ? (
          <img src={user.picture} alt="" className="account__avatar" />
        ) : (
          <span className="account__avatar account__avatar--blank" aria-hidden />
        )}
        <span className="account__name">{user.name.split(' ')[0]}</span>
      </button>

      {open ? (
        <div className="profile__menu" role="menu">
          <div className="profile__identity">
            <div className="list-row__name">{user.name}</div>
            <div className="text-xs muted">{user.email}</div>
          </div>

          <button
            type="button"
            role="menuitem"
            className="profile__item"
            disabled={busy}
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            <LogOut size={15} strokeWidth={1.75} />
            Sign out
          </button>

          <button
            type="button"
            role="menuitem"
            className="profile__item profile__item--danger"
            disabled={busy}
            onClick={() => void deleteAccount()}
          >
            <Trash2 size={15} strokeWidth={1.75} />
            Delete my account
          </button>

          <p className="profile__note">
            Deleting removes your sign-in, tokens and team memberships. Scores you gave stay, with
            your name taken off them.
          </p>
          {error ? <p className="of-field__error profile__note">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
