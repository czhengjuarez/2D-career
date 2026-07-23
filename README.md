# Career framework — skills × leadership

A two-axis career and remuneration framework, based on the
[Remuneration Diamond](https://www.corporate-rebels.com/blog/remuneration-method-for-flat-organizations)
method for flat organisations.

Two dimensions, three levels each, nine grades:

|  | **A** foundational | **B** developed | **C** advanced |
|---|---|---|---|
| **3** organisation | 3A | 3B | 3C |
| **2** team | 2A | 2B | 2C |
| **1** self | 1A | 1B | 1C |

Peers score the people they actually work with. The peer scores are averaged into one
grade, and that grade is *advice* — the team sets its own pay bands together, out loud, from
there. The number never decides on its own.

## What you can do

- **Home** — what the method is, how it runs, where it comes from, and the import template.
- **Matrix** — the 3 × 3 with pay bands (editable) and everyone plotted into their cell.
- **Framework** — add your own tracks, capabilities and leadership dimensions, and write the
  A/B/C and 1/2/3 descriptors for each. Four example tracks ship as a starting point:
  UX Design, Brand Design, UX Engineering, Engineering. Delete or rewrite any of them.
- **Assess** — score one person across every capability in their track plus the shared
  leadership dimensions. Self-scores are recorded and displayed but never counted.
- **People** — averaged peer advice per person, the band it points to, the spread between
  peers, and an "on the line" flag when an average sits on a level boundary.

## Two workspaces

- **This browser only** (default) — no account, everything in `localStorage`, nothing uploaded.
- **A team** — sign in with Google, create a team or join one with a 6-character code. The
  framework, the people and every score live in R2 and are shared by the whole team.

### Roles

| | member | admin | owner |
|---|---|---|---|
| Edit the framework, add people, submit scores | ✅ | ✅ | ✅ |
| Withdraw **their own** score | ✅ | ✅ | ✅ |
| Delete **anyone's** score | — | ✅ | ✅ |
| Rename the team, change the join code, remove members | — | ✅ | ✅ |
| Remove another admin | — | — | ✅ |
| Assign roles / hand over ownership | — | — | ✅ |
| Delete the team | — | — | ✅ |

### Why the admin model works this way

Pay data makes the usual "everyone can do everything" shortcut a bad idea, but a heavy
permission system would fight the flat-organisation premise. These are the decisions, and
the reasoning, so they can be argued with later rather than guessed at.

**Everything is enforced in the Worker.** The UI hides controls you cannot use, but every
rule is re-checked server-side in `handleTeam` ([worker/index.ts](worker/index.ts)). Hidden
buttons are a courtesy, not a control — anyone can call the API directly.

**Exactly one owner, and ownership transfers rather than multiplies.** Promoting someone to
owner steps the previous owner down to admin. Two owners means two people who can delete
the team and no one accountable for it. As a consequence the owner cannot use "leave team":
they hand ownership over first, or delete the team. An ownerless team would have nobody
able to assign roles again.

**Admins are for running the team; the owner is for deciding who runs it.** Admins rename,
rotate the join code and remove members — the day-to-day. Assigning roles and deleting the
team stay with the owner, and an admin cannot remove another admin, so no single admin can
quietly take the team over.

**Score deletion is split by author.** Scores are visible to everyone, which makes it
tempting to let anyone tidy them up — but a score is a person's stated judgement about a
colleague, and deleting someone else's is a different act from withdrawing your own. So:
anyone may withdraw a score they submitted, only admins may delete a score submitted by
someone else.

**Joining a team puts you on the roster.** The people being scored and the accounts in the
team are two different lists — a contractor with no login can still be assessed. But nobody
should have to re-type their colleagues, and the app needs to know which roster row is you
before it can handle self-scoring sensibly. So joining adds a row for you, adopting an
existing unclaimed row if the name already matches rather than creating a duplicate. Any
unclaimed row can be marked "That's me" on the People tab, and the account link is owned by
`POST /api/teams/:id/claim` — an ordinary state save cannot reassign it, or a member could
hand themselves someone else's row. Picking your own row in Assess switches the score to
`self` automatically, and warns if you switch it back to `peer`.

**The rater is taken from the session, never the request body.** The server overwrites
`rater` and `raterId` with the signed-in account on every submission. Attribution is the
thing that makes visible scores accountable, so it cannot be client-supplied.

**Removing a member keeps the scores they submitted.** Deleting them would silently
re-average everyone's grade at the exact moment somebody leaves the company. Departures
should not move other people's pay bands on their own.

**Deleting a team requires typing its name**, and clears the join-code pointer plus the team
reference on every member's user record. It is the one genuinely irreversible action here.

**A join code, not a shared password.** A shared secret would gate access but leave every
score anonymous and every action unattributable — which is precisely what this method needs
to avoid. The code is an invitation to a membership list; membership is what is actually
checked.

### Team lifecycle

**Teams are fully isolated.** Each has its own roster, framework, pay bands and scores.
One account can belong to several teams and gets a separate roster row in each, with its
own claim. Editing a person in one team never touches another, and grades never mix — the
same person can be `2B` in one team and `3C` in another, because each team defines for
itself what the levels mean.

**Removing a member keeps their row and their scores.** The row also stays linked to their
account, so rejoining with the code returns them to their old row instead of creating a
duplicate. Their access ends immediately and their other teams are untouched. While they are
out, their row still counts as claimed, so nobody else can claim it — an admin can delete the
row itself if it should be freed.

**Deleting a team is permanent.** The team object holds the framework, the roster and every
score, so deleting it removes all of that, plus the join-code pointer and the team reference
on every member's record. There is no trash, no undo and no bucket versioning: export first
if the framework is worth keeping. Anyone with the team open sees their next save fail
visibly ("Not saved", "Team not found.") rather than losing work silently, and lands back in
the local workspace on reload.

Known rough edges, both deliberate to leave for now:

- The 30-second poll swallows a 404, so someone idling on a deleted team is not told until
  they edit or reload.
- Deletion is immediate. There is no backup prompt or grace period on the one destructive
  action in the app.

### Deleting your account

Under the profile menu, next to sign out. It removes the sign-in record, every API token and
every team membership, and leaves a tombstone so outstanding session cookies stop working at
once rather than staying valid for their remaining 30 days.

What it deliberately does **not** do is rewrite the team's history. Scores you gave stay —
otherwise everyone you assessed would see their grade move the moment you left — but your
name comes off them, replaced by "Deleted account". Your roster row stays too, as the team's
record of a colleague, minus the link to your account. Teams you own pass to the
longest-standing admin, or the longest-standing member if there is no admin; a team where you
were the only member is deleted with you. Signing in again with the same Google account
starts a fresh, empty account.

### API access for agents

A signed-in user can mint a personal access token on the Team tab and send it as
`Authorization: Bearer <token>`. It acts as that person — their teams, their role, and their
name recorded as the rater on anything it submits, so an agent's scores are as accountable as
a human's. Tokens are shown once, stored only as a SHA-256 hash, listed with a last-used date
and revocable at any time.

Token management is deliberately cookie-only: a leaked token can use the API, but cannot mint
more tokens or revoke existing ones. `/llms.txt` documents the endpoints for agents.

### Concurrency

Framework edits use optimistic concurrency on a `stateVersion`: a save carrying a stale
version is rejected with a 409 and the newer copy is loaded, rather than overwriting a
colleague. That version is deliberately separate from the team `version` bumped by
membership changes and incoming scores — a teammate joining should not invalidate an edit
someone is part-way through.

Scores never travel through the whole-state save. They have their own append endpoint
backed by a conditional R2 write with retry, so two people scoring in the same second can
never drop each other's submission. A team workspace polls for teammates' changes every 30
seconds while the tab is visible and nothing is pending.

### Deploying with sign-in enabled

The Worker needs three secrets. Without them the app still runs, sign-in is hidden, and
`/api/me` reports `signInEnabled: false`.

```bash
npx wrangler secret put GOOGLE_CLIENT_ID       # OAuth 2.0 Web application client
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put JWT_SECRET             # any long random string; signs session cookies
```

In the Google Cloud console, the OAuth client needs:

- Authorised JavaScript origin — `https://<your-worker>.workers.dev`
- Authorised redirect URI — `https://<your-worker>.workers.dev/auth/google/callback`

Setting a secret creates and deploys a new Worker version on its own; the app code does not
need rebuilding. Rotating `JWT_SECRET` signs everyone out.

For local development put the same three keys in `.dev.vars` (gitignored) and run
`npx wrangler dev`. R2 is simulated locally unless you pass `--remote`.

Everything in the local workspace is stored in the browser's `localStorage`. Export / Import move a framework
between machines as JSON, **Template** downloads a blank file with the full structure and
notes on every field, and Reset restores the seeded example.

Currency is free text — a symbol (`€`, `$`, `£`), a code (`CHF`, `PLN`, which get a space
before the number), or empty for bare figures. The seeded amounts are the article's
examples and are meant to be replaced with your own market data.

## Credit

The method is the remuneration diamond described by Corporate Rebels in
[A Remuneration Method For Flat Organizations](https://www.corporate-rebels.com/blog/remuneration-method-for-flat-organizations).
This app is an implementation of it, not the source. If you write track descriptors that
work for a craft the seed does not cover, export the JSON and share it back — set
`REPO_URL` in [`src/template.ts`](src/template.ts) to turn the contribute card into a link.

## Design system

Styled with [Keel](https://keel.coscient.workers.dev) (`@ops-forward/keel`) — `of-` component
classes and `--of-*` tokens only, so light and dark mode come for free via `light-dark()`.

## Commands

```bash
npm install
npm run dev        # local dev server
npm run build      # typecheck + production build
npm run preview    # serve the production build
npm run lint       # oxlint
```

## Structure

```
worker/
├── index.ts               # routes: /auth/*, /api/*, everything else → static assets
├── auth.ts                # Google OAuth redirect flow, HS256 session cookie, join codes
└── storage.ts             # R2 layout + conditional read-modify-write on teams
src/
├── types.ts               # framework data model
├── scoring.ts             # axis definitions, averaging, grade + band lookup
├── seed.ts                # example tracks, leadership dimensions, pay bands
├── template.ts            # import template + source credit
├── api.ts                 # typed client for the Worker API
├── store.ts               # workspace state: localStorage or team-in-R2
├── app-shell.css          # layout built on Keel tokens
├── components/ui.tsx      # level picker, currency field, badges, meters
└── views/                 # Home, Matrix, Framework, Assess, People, Team
```

R2 keys: `users/{userId}.json`, `teams/{teamId}.json`, `codes/{JOINCODE}.json`.
