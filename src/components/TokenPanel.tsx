import { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Plus } from 'lucide-react';
import { ApiError, api, type AccessToken } from '../api';
import { DeleteButton } from './ui';

/**
 * Personal access tokens for agents and scripts. A token acts as the person who minted it,
 * so anything it submits is attributed to them — worth saying out loud in the UI.
 */
export function TokenPanel() {
  const [tokens, setTokens] = useState<AccessToken[]>([]);
  const [name, setName] = useState('');
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    api
      .listTokens()
      .then((r) => setTokens(r.tokens))
      .catch(() => setTokens([]));

  useEffect(() => {
    void load();
  }, []);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.createToken(name.trim() || 'Agent token');
      setSecret(result.secret);
      setName('');
      await load();
    } catch (thrown) {
      setError(thrown instanceof ApiError ? thrown.message : 'Could not create a token.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="of-card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3>
          <KeyRound size={16} strokeWidth={1.75} /> API access
        </h3>
        <span className="of-badge of-badge--default">{tokens.length}/10</span>
      </div>
      <p className="muted" style={{ marginTop: 'var(--of-space-2)' }}>
        A token lets an agent or script use the API as you — your teams, your role, and your
        name on every score it submits. Treat it like a password: anyone holding it can read
        and change everything you can. Revoke it here the moment it is no longer needed.
      </p>

      <div className="row" style={{ marginTop: 'var(--of-space-4)' }}>
        <input
          className="of-input"
          style={{ flex: 1, minWidth: 180 }}
          placeholder="What is it for? e.g. reporting script"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !busy && void create()}
        />
        <button
          type="button"
          className="of-btn of-btn--secondary of-btn--md"
          disabled={busy}
          onClick={() => void create()}
        >
          <Plus size={16} strokeWidth={1.75} />
          Create token
        </button>
      </div>

      {error ? (
        <p className="of-field__error" style={{ marginTop: 'var(--of-space-2)' }}>
          {error}
        </p>
      ) : null}

      {secret ? (
        <div className="token-reveal">
          <div className="section-title">Copy it now — it is not shown again</div>
          <code className="token-reveal__value">{secret}</code>
          <div className="row" style={{ marginTop: 'var(--of-space-3)' }}>
            <button
              type="button"
              className="of-btn of-btn--primary of-btn--sm"
              onClick={async () => {
                await navigator.clipboard.writeText(secret);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check size={15} strokeWidth={1.75} /> : <Copy size={15} strokeWidth={1.75} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              className="of-btn of-btn--ghost of-btn--sm"
              onClick={() => setSecret(null)}
            >
              Done
            </button>
          </div>
          <p className="text-xs muted" style={{ marginTop: 'var(--of-space-3)' }}>
            Send it as <span className="mono">Authorization: Bearer &lt;token&gt;</span>. See{' '}
            <a href="/llms.txt" target="_blank" rel="noreferrer">
              /llms.txt
            </a>{' '}
            for the endpoints.
          </p>
        </div>
      ) : null}

      {tokens.length > 0 ? (
        <div className="list" style={{ marginTop: 'var(--of-space-4)' }}>
          {tokens.map((token) => (
            <div key={token.id} className="list-row">
              <div className="list-row__main">
                <div className="list-row__name">{token.name}</div>
                <div className="text-xs muted">
                  created {new Date(token.createdAt).toLocaleDateString()} ·{' '}
                  {token.lastUsedAt
                    ? `last used ${new Date(token.lastUsedAt).toLocaleDateString()}`
                    : 'never used'}
                </div>
              </div>
              <DeleteButton
                label={`Revoke ${token.name}`}
                onClick={() => {
                  if (!confirm(`Revoke "${token.name}"? Anything using it stops working at once.`))
                    return;
                  void api.revokeToken(token.id).then(load);
                }}
              />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
