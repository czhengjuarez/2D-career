/// <reference types="@cloudflare/workers-types" />

import type { AppState, Assessment } from '../src/types';
import { seedState, uid } from '../src/seed';
import {
  SESSION_COOKIE,
  SESSION_TTL,
  STATE_COOKIE,
  cookie,
  decodeIdToken,
  joinCode,
  randomToken,
  readCookie,
  sign,
  verify,
  type SessionUser,
} from './auth';
import {
  bearerFrom,
  mintToken,
  parseToken,
  safeEqual,
  sha256,
  tokenKey,
  tokenSummary,
  type StoredToken,
} from './tokens';
import {
  codeKey,
  getJson,
  isAdmin,
  isMember,
  mutateTeam,
  putJson,
  roleOf,
  teamKey,
  teamSummary,
  tombstoneKey,
  userKey,
  type StoredUser,
  type Team,
  type TeamRole,
} from './storage';

export interface Env {
  ASSETS: Fetcher;
  DATA: R2Bucket;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  JWT_SECRET?: string;
}

const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...init.headers },
  });

const fail = (status: number, message: string) => json({ error: message }, { status });

type AuthVia = 'cookie' | 'token';

/**
 * Two ways in: the browser session cookie, or a personal access token in an Authorization
 * header. `via` matters because token management itself is cookie-only — a leaked token
 * must not be able to mint more of them.
 */
async function authenticate(
  request: Request,
  env: Env,
): Promise<{ user: SessionUser; via: AuthVia } | null> {
  if (!env.JWT_SECRET) return null;

  const cookieValue = readCookie(request, SESSION_COOKIE);
  if (cookieValue) {
    const user = await verify<SessionUser & { exp: number }>(cookieValue, env.JWT_SECRET);
    // The session JWT stays valid for 30 days on its own, so a deleted account could keep
    // using an outstanding cookie. The tombstone makes deletion take effect immediately.
    if (user && !(await env.DATA.head(tombstoneKey(user.id)))) {
      return { user, via: 'cookie' };
    }
  }

  const bearer = bearerFrom(request);
  if (!bearer) return null;
  const parsed = parseToken(bearer);
  if (!parsed) return null;

  const stored = await getJson<StoredToken>(env.DATA, tokenKey(parsed.id));
  if (!stored) return null;
  if (!safeEqual(stored.hash, await sha256(parsed.secret))) return null;

  const owner = await getJson<StoredUser>(env.DATA, userKey(stored.userId));
  if (!owner) return null;

  // Touch at most hourly: this runs on every request and is only ever used to spot
  // tokens nobody is using any more.
  const lastUsed = stored.lastUsedAt ? Date.parse(stored.lastUsedAt) : 0;
  if (Date.now() - lastUsed > 3_600_000) {
    await putJson(env.DATA, tokenKey(stored.id), {
      ...stored,
      lastUsedAt: new Date().toISOString(),
    });
  }

  return {
    user: { id: owner.id, email: owner.email, name: owner.name, picture: owner.picture },
    via: 'token',
  };
}

/**
 * Deleting an account reconciles two things: the person's right to disappear, and the team's
 * need for its scoring history to stay intact. The account, its tokens and its memberships
 * go; the scores stay but lose the name attached to them; and a team that would be left
 * ownerless is either handed to someone else or removed with its last member.
 */
async function deleteAccount(env: Env, user: SessionUser): Promise<Response> {
  const stored = await getJson<StoredUser>(env.DATA, userKey(user.id));
  if (!stored) return json({ ok: true });

  for (const id of stored.tokenIds ?? []) {
    await env.DATA.delete(tokenKey(id));
  }

  for (const teamId of stored.teamIds) {
    const team = await getJson<Team>(env.DATA, teamKey(teamId));
    if (!team) continue;

    const others = team.members.filter((member) => member.userId !== user.id);
    const wasOwner = roleOf(team, user.id) === 'owner';

    if (others.length === 0) {
      // Nobody left to inherit it.
      await env.DATA.delete(codeKey(team.code));
      await env.DATA.delete(teamKey(teamId));
      continue;
    }

    await mutateTeam(env.DATA, teamId, (current) => {
      let members = current.members.filter((member) => member.userId !== user.id);
      if (wasOwner) {
        // Longest-standing admin first, then longest-standing member.
        const heir = [...members].sort(
          (a, b) =>
            Number(b.role === 'admin') - Number(a.role === 'admin') ||
            a.joinedAt.localeCompare(b.joinedAt),
        )[0];
        members = members.map((member) =>
          member.userId === heir.userId ? { ...member, role: 'owner' } : member,
        );
      }
      current.members = members;
      current.state = {
        ...current.state,
        // The roster row stays — it is the team's record of a colleague — but it is no
        // longer linked to any account.
        people: current.state.people.map((person) =>
          person.accountId === user.id ? { ...person, accountId: undefined } : person,
        ),
        // Grades must not move because someone deleted their account, so scores remain
        // and only the attribution is stripped.
        assessments: current.state.assessments.map((assessment) =>
          assessment.raterId === user.id
            ? { ...assessment, rater: 'Deleted account', raterId: undefined }
            : assessment,
        ),
      };
      current.stateVersion = current.version + 1;
      return current;
    });
  }

  await env.DATA.delete(userKey(user.id));
  await putJson(env.DATA, tombstoneKey(user.id), { deletedAt: new Date().toISOString() });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'set-cookie': cookie(SESSION_COOKIE, '', 0),
    },
  });
}

async function handleTokens(
  request: Request,
  env: Env,
  user: SessionUser,
  segments: string[],
): Promise<Response> {
  const stored = await getJson<StoredUser>(env.DATA, userKey(user.id));
  const tokenIds = stored?.tokenIds ?? [];

  if (request.method === 'GET' && segments.length === 0) {
    const tokens = await Promise.all(tokenIds.map((id) => getJson<StoredToken>(env.DATA, tokenKey(id))));
    return json({ tokens: tokens.filter((t): t is StoredToken => t != null).map(tokenSummary) });
  }

  if (request.method === 'POST' && segments.length === 0) {
    const body = (await request.json().catch(() => ({}))) as { name?: string };
    const name = (body.name ?? '').trim() || 'Agent token';
    if (tokenIds.length >= 10) return fail(400, 'Ten tokens is the limit — revoke one first.');

    const minted = mintToken();
    const record: StoredToken = {
      id: minted.id,
      userId: user.id,
      name,
      hash: await sha256(minted.secret),
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
    };
    await putJson(env.DATA, tokenKey(record.id), record);
    await putJson(env.DATA, userKey(user.id), {
      ...(stored ?? { ...user, createdAt: new Date().toISOString(), teamIds: [] }),
      tokenIds: [...tokenIds, record.id],
    });
    // The only time the secret exists in a response.
    return json({ token: tokenSummary(record), secret: minted.display });
  }

  if (request.method === 'DELETE' && segments.length === 1) {
    const id = segments[0];
    if (!tokenIds.includes(id)) return fail(404, 'No such token.');
    await env.DATA.delete(tokenKey(id));
    await putJson(env.DATA, userKey(user.id), {
      ...(stored ?? { ...user, createdAt: new Date().toISOString(), teamIds: [] }),
      tokenIds: tokenIds.filter((existing) => existing !== id),
    });
    return json({ ok: true });
  }

  return fail(405, 'Unsupported request.');
}

/* -------------------------------------------------------------------------- */
/* auth                                                                       */
/* -------------------------------------------------------------------------- */

function startLogin(request: Request, env: Env): Response {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.JWT_SECRET) {
    return fail(503, 'Sign-in is not configured on this deployment.');
  }
  const origin = new URL(request.url).origin;
  const state = randomToken();
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${origin}/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  return new Response(null, {
    status: 302,
    headers: {
      location: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
      'set-cookie': cookie(STATE_COOKIE, state, 600),
    },
  });
}

async function finishLogin(request: Request, env: Env): Promise<Response> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.JWT_SECRET) {
    return fail(503, 'Sign-in is not configured on this deployment.');
  }
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expected = readCookie(request, STATE_COOKIE);
  if (!code || !state || !expected || state !== expected) {
    return Response.redirect(`${url.origin}/?auth=failed`, 302);
  }

  const token = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${url.origin}/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  });
  if (!token.ok) return Response.redirect(`${url.origin}/?auth=failed`, 302);

  const payload = (await token.json()) as { id_token?: string };
  const claims = payload.id_token ? decodeIdToken(payload.id_token) : null;
  if (!claims?.sub) return Response.redirect(`${url.origin}/?auth=failed`, 302);

  const user: SessionUser = {
    id: `g_${claims.sub}`,
    email: claims.email ?? '',
    name: claims.name || claims.email || 'Signed-in user',
    picture: claims.picture ?? '',
  };

  // Signing in again after deleting starts a fresh account under the same Google id.
  await env.DATA.delete(tombstoneKey(user.id));
  const existing = await getJson<StoredUser>(env.DATA, userKey(user.id));
  await putJson(env.DATA, userKey(user.id), {
    ...user,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    teamIds: existing?.teamIds ?? [],
  } satisfies StoredUser);

  const session = await sign(
    { ...user, exp: Math.floor(Date.now() / 1000) + SESSION_TTL },
    env.JWT_SECRET,
  );

  return new Response(null, {
    status: 302,
    headers: {
      location: `${url.origin}/?signed-in=1`,
      'set-cookie': cookie(SESSION_COOKIE, session, SESSION_TTL),
    },
  });
}

/* -------------------------------------------------------------------------- */
/* teams                                                                      */
/* -------------------------------------------------------------------------- */

async function listTeams(env: Env, user: SessionUser) {
  const stored = await getJson<StoredUser>(env.DATA, userKey(user.id));
  const teams = await Promise.all(
    (stored?.teamIds ?? []).map((id) => getJson<Team>(env.DATA, teamKey(id))),
  );
  return teams.filter((team): team is Team => team != null).map(teamSummary);
}

async function addTeamToUser(env: Env, user: SessionUser, teamId: string) {
  const stored = (await getJson<StoredUser>(env.DATA, userKey(user.id))) ?? {
    ...user,
    createdAt: new Date().toISOString(),
    teamIds: [],
  };
  if (!stored.teamIds.includes(teamId)) stored.teamIds.push(teamId);
  await putJson(env.DATA, userKey(user.id), { ...stored, ...user });
}

/**
 * Everyone in a team should be scoreable without someone re-typing the roster by hand.
 * An unclaimed row with a matching name is adopted rather than duplicated.
 */
function ensureRosterEntry(state: AppState, user: SessionUser): AppState {
  if (state.people.some((person) => person.accountId === user.id)) return state;

  const match = state.people.find(
    (person) =>
      !person.accountId && person.name.trim().toLowerCase() === user.name.trim().toLowerCase(),
  );
  if (match) {
    return {
      ...state,
      people: state.people.map((person) =>
        person.id === match.id ? { ...person, accountId: user.id } : person,
      ),
    };
  }

  return {
    ...state,
    people: [
      ...state.people,
      {
        id: uid('per'),
        name: user.name,
        role: '',
        trackId: state.tracks[0]?.id ?? '',
        accountId: user.id,
      },
    ],
  };
}

async function createTeam(request: Request, env: Env, user: SessionUser): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const name = (body.name ?? '').trim();
  if (!name) return fail(400, 'A team needs a name.');

  let code = joinCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const taken = await env.DATA.head(codeKey(code));
    if (!taken) break;
    code = joinCode();
  }

  const team: Team = {
    id: uid('team'),
    name,
    code,
    createdAt: new Date().toISOString(),
    version: 1,
    stateVersion: 1,
    members: [
      {
        userId: user.id,
        name: user.name,
        email: user.email,
        picture: user.picture,
        role: 'owner',
        joinedAt: new Date().toISOString(),
      },
    ],
    state: ensureRosterEntry(seedState(), user),
  };

  await putJson(env.DATA, teamKey(team.id), team);
  await putJson(env.DATA, codeKey(code), { teamId: team.id });
  await addTeamToUser(env, user, team.id);
  return json({ team: teamSummary(team), state: team.state });
}

async function joinTeam(request: Request, env: Env, user: SessionUser): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { code?: string };
  const code = (body.code ?? '').trim().toUpperCase();
  if (!code) return fail(400, 'Enter a join code.');

  const pointer = await getJson<{ teamId: string }>(env.DATA, codeKey(code));
  if (!pointer) return fail(404, 'No team uses that code.');

  const team = await mutateTeam(env.DATA, pointer.teamId, (current) => {
    current.state = ensureRosterEntry(current.state, user);
    if (isMember(current, user.id)) return current;
    current.members.push({
      userId: user.id,
      name: user.name,
      email: user.email,
      picture: user.picture,
      role: 'member',
      joinedAt: new Date().toISOString(),
    });
    return current;
  });
  if (!team) return fail(404, 'That team no longer exists.');

  await addTeamToUser(env, user, team.id);
  return json({ team: teamSummary(team), state: team.state });
}

async function handleTeam(
  request: Request,
  env: Env,
  user: SessionUser,
  segments: string[],
): Promise<Response> {
  const [teamId, action, actionId] = segments;
  const team = await getJson<Team>(env.DATA, teamKey(teamId));
  if (!team) return fail(404, 'Team not found.');
  if (!isMember(team, user.id)) return fail(403, 'You are not a member of that team.');

  // GET /api/teams/:id
  if (request.method === 'GET' && !action) {
    return json({ team: teamSummary(team), state: team.state });
  }

  // PUT /api/teams/:id — framework, people and pay bands
  if (request.method === 'PUT' && !action) {
    const body = (await request.json().catch(() => ({}))) as {
      state?: AppState;
      version?: number;
    };
    if (!body.state) return fail(400, 'Missing state.');
    let stale = false;
    const updated = await mutateTeam(env.DATA, teamId, (current) => {
      if (typeof body.version === 'number' && body.version !== current.stateVersion) {
        stale = true;
        return current;
      }
      // Account links are owned by the claim endpoint: a client could otherwise
      // hand itself someone else's roster row through an ordinary save.
      const links = new Map(current.state.people.map((p) => [p.id, p.accountId]));
      const people = body.state!.people.map((person) =>
        links.has(person.id)
          ? { ...person, accountId: links.get(person.id) }
          : { ...person, accountId: undefined },
      );
      // Scores are appended through their own endpoint, so a slow editor can never
      // drop a colleague's assessment by saving an older copy of the list.
      current.state = { ...body.state!, people, assessments: current.state.assessments };
      current.stateVersion = current.version + 1;
      return current;
    });
    if (stale) {
      return json(
        { error: 'stale', team: teamSummary(updated!), state: updated!.state },
        { status: 409 },
      );
    }
    return json({ team: teamSummary(updated!), state: updated!.state });
  }

  // POST /api/teams/:id/assessments
  if (request.method === 'POST' && action === 'assessments') {
    const body = (await request.json().catch(() => ({}))) as { assessment?: Assessment };
    if (!body.assessment) return fail(400, 'Missing assessment.');
    const updated = await mutateTeam(env.DATA, teamId, (current) => {
      current.state.assessments = [
        ...current.state.assessments,
        // The rater is taken from the session, never from the request body.
        { ...body.assessment!, id: uid('asm'), rater: user.name, raterId: user.id },
      ];
      return current;
    });
    return json({ team: teamSummary(updated!), state: updated!.state });
  }

  // DELETE /api/teams/:id/assessments/:assessmentId
  if (request.method === 'DELETE' && action === 'assessments' && actionId) {
    const target = team.state.assessments.find((a) => a.id === actionId);
    // You can always withdraw your own score; deleting someone else's is an admin act.
    if (target && target.raterId && target.raterId !== user.id && !isAdmin(team, user.id)) {
      return fail(403, "Only an admin can delete another person's score.");
    }
    const updated = await mutateTeam(env.DATA, teamId, (current) => {
      current.state.assessments = current.state.assessments.filter((a) => a.id !== actionId);
      return current;
    });
    return json({ team: teamSummary(updated!), state: updated!.state });
  }

  // POST /api/teams/:id/claim — say which roster row is you (null to unclaim)
  if (request.method === 'POST' && action === 'claim') {
    const body = (await request.json().catch(() => ({}))) as { personId?: string | null };
    const personId = body.personId ?? null;
    if (personId && !team.state.people.some((p) => p.id === personId)) {
      return fail(404, 'No such person on the roster.');
    }
    const taken = team.state.people.find(
      (p) => p.id === personId && p.accountId && p.accountId !== user.id,
    );
    if (taken) return fail(409, 'Someone else has already claimed that row.');

    const updated = await mutateTeam(env.DATA, teamId, (current) => {
      current.state = {
        ...current.state,
        // You can only ever point a row at yourself, and only at one row.
        people: current.state.people.map((person) => {
          if (person.id === personId) return { ...person, accountId: user.id };
          if (person.accountId === user.id) return { ...person, accountId: undefined };
          return person;
        }),
      };
      current.stateVersion = current.version + 1;
      return current;
    });
    return json({ team: teamSummary(updated!), state: updated!.state });
  }

  // PATCH /api/teams/:id — rename
  if (request.method === 'PATCH' && !action) {
    if (!isAdmin(team, user.id)) return fail(403, 'Only an admin can rename the team.');
    const body = (await request.json().catch(() => ({}))) as { name?: string };
    const name = (body.name ?? '').trim();
    if (!name) return fail(400, 'A team needs a name.');
    const updated = await mutateTeam(env.DATA, teamId, (current) => {
      current.name = name;
      return current;
    });
    return json({ team: teamSummary(updated!), state: updated!.state });
  }

  // PUT /api/teams/:id/members/:userId — change a role
  if (request.method === 'PUT' && action === 'members' && actionId) {
    if (roleOf(team, user.id) !== 'owner') {
      return fail(403, 'Only the owner can change roles.');
    }
    const body = (await request.json().catch(() => ({}))) as { role?: TeamRole };
    const role = body.role;
    if (role !== 'owner' && role !== 'admin' && role !== 'member') {
      return fail(400, 'Unknown role.');
    }
    if (actionId === user.id && role !== 'owner') {
      return fail(400, 'Hand ownership to someone else rather than demoting yourself.');
    }
    if (!isMember(team, actionId)) return fail(404, 'That person is not in the team.');

    const updated = await mutateTeam(env.DATA, teamId, (current) => {
      current.members = current.members.map((member) => {
        if (member.userId === actionId) return { ...member, role };
        // A team has exactly one owner, so handing it over steps the old owner down.
        if (role === 'owner' && member.role === 'owner') return { ...member, role: 'admin' };
        return member;
      });
      return current;
    });
    return json({ team: teamSummary(updated!), state: updated!.state });
  }

  // DELETE /api/teams/:id/members/:userId — remove someone
  if (request.method === 'DELETE' && action === 'members' && actionId) {
    if (!isAdmin(team, user.id)) return fail(403, 'Only an admin can remove members.');
    const targetRole = roleOf(team, actionId);
    if (!targetRole) return fail(404, 'That person is not in the team.');
    if (targetRole === 'owner') return fail(403, 'The owner cannot be removed.');
    if (actionId === user.id) return fail(400, 'Use "leave team" to remove yourself.');
    if (targetRole === 'admin' && roleOf(team, user.id) !== 'owner') {
      return fail(403, 'Only the owner can remove another admin.');
    }

    const updated = await mutateTeam(env.DATA, teamId, (current) => {
      current.members = current.members.filter((member) => member.userId !== actionId);
      return current;
    });
    const stored = await getJson<StoredUser>(env.DATA, userKey(actionId));
    if (stored) {
      await putJson(env.DATA, userKey(actionId), {
        ...stored,
        teamIds: stored.teamIds.filter((id) => id !== teamId),
      });
    }
    // Their scores stay: removing a person should not silently rewrite everyone's grades.
    return json({ team: teamSummary(updated!), state: updated!.state });
  }

  // DELETE /api/teams/:id — owner deletes the team outright
  if (request.method === 'DELETE' && !action) {
    if (roleOf(team, user.id) !== 'owner') return fail(403, 'Only the owner can delete the team.');
    for (const member of team.members) {
      const stored = await getJson<StoredUser>(env.DATA, userKey(member.userId));
      if (!stored) continue;
      await putJson(env.DATA, userKey(member.userId), {
        ...stored,
        teamIds: stored.teamIds.filter((id) => id !== teamId),
      });
    }
    await env.DATA.delete(codeKey(team.code));
    await env.DATA.delete(teamKey(teamId));
    return json({ ok: true });
  }

  // POST /api/teams/:id/code — rotate the join code
  if (request.method === 'POST' && action === 'code') {
    if (!isAdmin(team, user.id)) return fail(403, 'Only an admin can change the join code.');
    const next = joinCode();
    const updated = await mutateTeam(env.DATA, teamId, (current) => {
      current.code = next;
      return current;
    });
    await env.DATA.delete(codeKey(team.code));
    await putJson(env.DATA, codeKey(next), { teamId });
    return json({ team: teamSummary(updated!), state: updated!.state });
  }

  // POST /api/teams/:id/leave
  if (request.method === 'POST' && action === 'leave') {
    await mutateTeam(env.DATA, teamId, (current) => {
      current.members = current.members.filter((m) => m.userId !== user.id);
      return current;
    });
    const stored = await getJson<StoredUser>(env.DATA, userKey(user.id));
    if (stored) {
      await putJson(env.DATA, userKey(user.id), {
        ...stored,
        teamIds: stored.teamIds.filter((id) => id !== teamId),
      });
    }
    return json({ ok: true });
  }

  return fail(405, 'Unsupported request.');
}

/* -------------------------------------------------------------------------- */

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/auth/google') return startLogin(request, env);
    if (path === '/auth/google/callback') return finishLogin(request, env);
    if (path === '/auth/logout' && request.method === 'POST') {
      return new Response(null, {
        status: 204,
        headers: { 'set-cookie': cookie(SESSION_COOKIE, '', 0) },
      });
    }

    if (path.startsWith('/api/')) {
      const auth = await authenticate(request, env);
      const user = auth?.user ?? null;

      // Deleting the account is destructive and irreversible: browser session only.
      // Checked before the GET below, which does not look at the method.
      if (path === '/api/me' && request.method === 'DELETE') {
        if (!user) return fail(401, 'Sign in first.');
        if (auth!.via !== 'cookie') {
          return fail(403, 'Deleting an account requires a signed-in browser session.');
        }
        return deleteAccount(env, user);
      }

      if (path === '/api/me') {
        if (!user) {
          return json({
            user: null,
            teams: [],
            signInEnabled: Boolean(env.GOOGLE_CLIENT_ID && env.JWT_SECRET),
          });
        }
        return json({
          user,
          teams: await listTeams(env, user),
          signInEnabled: true,
          via: auth!.via,
        });
      }

      if (!user) return fail(401, 'Sign in first.');

      if (path === '/api/tokens' || path.startsWith('/api/tokens/')) {
        // A token must not be able to mint or revoke tokens.
        if (auth!.via !== 'cookie') {
          return fail(403, 'Token management requires a signed-in browser session.');
        }
        return handleTokens(request, env, user, path.slice('/api/tokens'.length).split('/').filter(Boolean));
      }

      if (path === '/api/teams' && request.method === 'POST') return createTeam(request, env, user);
      if (path === '/api/teams/join' && request.method === 'POST') return joinTeam(request, env, user);

      if (path.startsWith('/api/teams/')) {
        const segments = path.slice('/api/teams/'.length).split('/').filter(Boolean);
        if (segments.length) {
          try {
            return await handleTeam(request, env, user, segments);
          } catch (error) {
            if (error instanceof Error && error.message === 'conflict') {
              return fail(429, 'Too many people saving at once — try again.');
            }
            throw error;
          }
        }
      }

      return fail(404, 'Unknown endpoint.');
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
