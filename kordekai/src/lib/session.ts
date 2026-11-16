import { cache } from "react";
import { cookies } from "next/headers";
import { env } from "./env";
import { sql } from "./db";
import { hmac, newToken } from "./crypto";
import { HttpError } from "./http";

const SESSION_DAYS = 30;
const COOKIE = () => (env.isProd ? "__Host-kordek_session" : "kordek_session");

export type Theme = "dark" | "light" | "system";

export type SessionUser = {
  id: string;
  username: string;
  role: "user" | "admin";
  isDeveloper: boolean;
  theme: Theme;
  customInstructions: string;
  banned: null | { reason: string; expiresAt: string | null };
};

export async function createSession(userId: string, ipH: string, userAgent: string | null) {
  const token = newToken();
  await sql`
    insert into sessions (user_id, token_hash, ip_hash, user_agent, expires_at)
    values (${userId}, ${hmac(token, "session")}, ${ipH}, ${userAgent?.slice(0, 300) ?? null},
            now() + make_interval(days => ${SESSION_DAYS}))`;
  (await cookies()).set(COOKIE(), token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE())?.value;
  if (token) await sql`delete from sessions where token_hash = ${hmac(token, "session")}`;
  jar.delete(COOKIE());
}

type Row = {
  id: string;
  username: string;
  role: "user" | "admin";
  theme: Theme;
  custom_instructions: string;
  is_banned: boolean;
  ban_reason: string | null;
  ban_expires_at: Date | null;
};

/** Resolves the current user from the session cookie. Always hits the database, so bans apply immediately. */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE())?.value;
  if (!token || token.length > 128) return null;
  const rows = await sql<Row[]>`
    select u.id, u.username, u.role, u.theme, u.custom_instructions, u.is_banned, u.ban_reason, u.ban_expires_at
    from sessions s join users u on u.id = s.user_id
    where s.token_hash = ${hmac(token, "session")} and s.expires_at > now()`;
  const u = rows[0];
  if (!u) return null;
  const banActive = u.is_banned && (!u.ban_expires_at || u.ban_expires_at > new Date());
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    // Admin rights need BOTH the DB role and the reserved username from the environment.
    isDeveloper: u.role === "admin" && env.developerUsername !== "" && u.username.toLowerCase() === env.developerUsername,
    theme: u.theme,
    customInstructions: u.custom_instructions,
    banned: banActive ? { reason: u.ban_reason ?? "", expiresAt: u.ban_expires_at?.toISOString() ?? null } : null,
  };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new HttpError(401, "Please sign in.", "unauthenticated");
  if (user.banned) throw new HttpError(403, "This account is suspended.", "banned");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isDeveloper) throw new HttpError(403, "Forbidden.", "forbidden");
  return user;
}
