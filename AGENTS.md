# 2D Career — Agent Knowledge Base

A two-axis career and remuneration framework (skills & capabilities A/B/C × leadership
1/2/3), based on the Corporate Rebels remuneration diamond. React SPA + Cloudflare Worker,
deployed at https://2d-career.coscient.workers.dev.

Read this file first. [README.md](README.md) explains the product and the reasoning behind
the permission model — read that before changing anything about roles or scoring.

## Where to look

| Need | Location |
|---|---|
| Framework data model | `src/types.ts` |
| Scoring, axis definitions, grade → band | `src/scoring.ts` |
| Seeded example tracks and bands | `src/seed.ts` |
| Client state, local vs team workspace, sync | `src/store.ts` |
| Typed API client | `src/api.ts` |
| Screens | `src/views/` |
| Shared UI (level picker, currency field, badges) | `src/components/ui.tsx` |
| App layout CSS (Keel tokens only) | `src/app-shell.css` |
| Worker routes, all permission checks | `worker/index.ts` |
| OAuth, JWT session cookie, join codes | `worker/auth.ts` |
| R2 layout, conditional writes, role helpers | `worker/storage.ts` |
| Deploy config, R2 binding, asset routing | `wrangler.jsonc` |

## Commands

```bash
npm run dev                  # Vite only — no API; sign-in and teams will not work
npx wrangler dev             # full stack: Worker + API + local R2 (needs .dev.vars)
npm run build                # tsc -b (app + worker projects) then vite build
npm run lint                 # oxlint
npx wrangler deploy          # build first — deploy uploads whatever is in dist/
```

`npm run build` must pass before deploying: `dist/` is uploaded as-is, so a stale build ships
stale UI against a fresh Worker.

## Architecture

- The Worker owns `/auth/*` and `/api/*`; everything else falls through to static assets.
  `assets.run_worker_first` in `wrangler.jsonc` is what stops SPA fallback from answering API
  routes with `index.html`. Do not remove it.
- Two workspaces share one set of actions in `src/store.ts`: `local` persists to
  `localStorage`, a team id persists to R2 through the API. Views do not know which is active.
- R2 keys: `users/{userId}.json`, `teams/{teamId}.json`, `codes/{JOINCODE}.json`,
  `tokens/{tokenId}.json`, `deleted/{userId}.json`.
- Sessions are HS256 JWTs in an HttpOnly, Secure, SameSite=Lax cookie signed with
  `JWT_SECRET`. There is no session store to invalidate; rotating the secret logs everyone out.

## API surface

Every `/api/*` route needs a credential — a session cookie or a personal access token;
`handleTeam` re-checks membership and role on each one. Responses that mutate a team return
`{ team, state }`.

| Route | Method | Who |
|---|---|---|
| `/auth/google` → `/auth/google/callback` | GET | anyone (OAuth redirect flow) |
| `/auth/logout` | POST | anyone |
| `/api/me` | GET | anyone — returns `{ user, teams, signInEnabled }`, `user: null` when signed out |
| `/api/teams` | POST | signed in — `{ name }`, creator becomes owner and lands on the roster |
| `/api/teams/join` | POST | signed in — `{ code }`, case-insensitive |
| `/api/teams/:id` | GET | member |
| `/api/teams/:id` | PUT | member — `{ state, version }` where `version` is `stateVersion`; 409 returns the newer copy |
| `/api/teams/:id` | PATCH | admin — `{ name }` |
| `/api/teams/:id` | DELETE | owner — irreversible |
| `/api/teams/:id/assessments` | POST | member — `{ assessment }`; server sets `rater`/`raterId` |
| `/api/teams/:id/assessments/:assessmentId` | DELETE | the rater, or an admin |
| `/api/teams/:id/claim` | POST | member — `{ personId }` or `{ personId: null }` to unclaim |
| `/api/teams/:id/members/:userId` | PUT | owner — `{ role: 'owner' \| 'admin' \| 'member' }` |
| `/api/teams/:id/members/:userId` | DELETE | admin (owner to remove an admin) |
| `/api/teams/:id/code` | POST | admin — rotates the join code |
| `/api/teams/:id/leave` | POST | member — owners must hand over or delete instead |
| `/api/tokens` | GET / POST | signed in — **cookie only** |
| `/api/tokens/:id` | DELETE | signed in — **cookie only** |
| `/api/me` | DELETE | signed in — **cookie only**, deletes the account |

Two credentials: the session cookie, or `Authorization: Bearer car_<id>_<secret>` from a
personal access token. A token acts as its owner — same teams, same role, their name as the
rater on anything it submits. `authenticate()` returns `via: 'cookie' | 'token'`, and token
management is gated on `via === 'cookie'` so a leaked token cannot mint or revoke tokens.
Only a SHA-256 hash of the secret is stored, in `tokens/{tokenId}.json`; the plaintext exists
exactly once, in the mint response.

`public/llms.txt` is served at `/llms.txt` and describes the app, the data model and this API
for agents pointed at the deployment. **Keep it in step with any API change.**

## Lifecycle rules

- Teams are isolated: separate roster, framework, bands and scores. One account gets a
  separate roster row per team, and grades never cross teams.
- Removing a member keeps their roster row (still linked to their account, so rejoining
  restores it) and every score they submitted.
- Deleting a team removes the framework, roster and all scores, the join-code pointer, and
  the team reference on each member's user record. Irreversible — no versioning on the bucket.
- A client whose team disappears fails visibly on next save and falls back to the local
  workspace on reload. The poll currently swallows the 404 (known gap).

## Rules that matter

- **Re-check every permission in the Worker.** Hiding a control in the UI is a courtesy, not
  a control. Role helpers are `roleOf` / `isAdmin` / `isMember` in `worker/storage.ts`.
- **Never trust `rater` from the request body.** The server sets `rater` and `raterId` from
  the session on every assessment.
- **Scores go through `POST /api/teams/:id/assessments`**, never through the whole-state PUT.
  The PUT handler deliberately preserves `current.state.assessments` and discards whatever
  the client sent, so a slow editor cannot drop a colleague's score.
- **Account links on roster rows are server-owned.** `Person.accountId` is set only by
  `POST /api/teams/:id/claim`; the state PUT re-applies the existing links and discards
  whatever the client sent. Joining a team calls `ensureRosterEntry`, which adopts a
  name-matching unclaimed row instead of creating a duplicate.
- **Mutate teams through `mutateTeam`**, which does a conditional R2 write against the object
  etag and retries. A bare `put` on a team object can silently overwrite a concurrent write.
- **`stateVersion` vs `version`**: clients send `stateVersion` when saving the framework;
  `version` changes on any write at all. Do not collapse them — membership changes and
  incoming scores must not invalidate an in-flight edit.
- **Theming flips `color-scheme`, never token values.** `:root[data-theme='light'\|'dark']`
  rules in `app-shell.css` re-resolve Keel's `light-dark()` tokens; no theme ever redefines a
  colour. Setting `color-scheme` as an inline style does *not* re-resolve them — use the
  attribute.
- **Account deletion leaves a tombstone** at `deleted/{userId}.json`, checked on every cookie
  auth, because the session JWT stays valid for 30 days on its own. Signing in again with the
  same Google account clears it.
- **Styling is Keel only.** `of-` classes from `@ops-forward/keel` and `--of-*` tokens. No
  hard-coded colours, spacing or radii; light/dark comes free from `light-dark()`. Icons are
  Lucide at `strokeWidth={1.75}`.
- **Secrets never reach the client.** `GOOGLE_CLIENT_SECRET` and `JWT_SECRET` are Worker
  secrets read off `env` per request. Nothing sensitive belongs in a `VITE_*` var — those are
  compiled into the bundle.

## Secrets and deployment

Three Worker secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`. Without them
the app still serves, sign-in is hidden, and `/api/me` returns `signInEnabled: false`.

```bash
npx wrangler secret put GOOGLE_CLIENT_SECRET   # prompts; never pass the value as an argument
```

Setting or rotating a secret creates and deploys a new Worker version on its own — **no code
redeploy is needed**. Rotating `JWT_SECRET` signs every user out; rotating the Google secret
does not.

For local work put the same three keys in `.dev.vars` (gitignored, real values not required
for anything except a genuine Google sign-in).

## Testing

There is no test suite. Verify changes by running `npx wrangler dev` and driving the real
thing — Playwright against `http://localhost:8788`, or `fetch` against the API with a
locally minted session cookie (HS256 over the `.dev.vars` `JWT_SECRET`, payload
`{id, email, name, picture, exp}`). When touching permissions, test the denials, not only
the happy path.

## Anti-patterns

- Don't add a UI-only permission check without the matching Worker guard.
- Don't edit `dist/` — it is generated.
- Don't introduce a second owner role or an ownerless team state (see README).
- Don't delete a departing member's scores; grades must not move because someone left.
- Don't add runtime dependencies for things Keel already provides.
- Don't store a token secret anywhere — only its hash. Never log or return it after minting.
- Don't let token auth reach `/api/tokens*`; that gate is what contains a leaked token.
- Don't reach for a framework router; the app is tab state in `src/App.tsx` by design.
