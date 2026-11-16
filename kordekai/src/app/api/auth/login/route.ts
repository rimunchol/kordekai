import { route, json, readJson, clientIp, ipHash, HttpError } from "@/lib/http";
import { loginSchema } from "@/lib/validation";
import { enforce } from "@/lib/ratelimit";
import { sql } from "@/lib/db";
import { fakeVerify, verifyPassword } from "@/lib/crypto";
import { createSession } from "@/lib/session";

export const runtime = "nodejs";

export const POST = route(async (req) => {
  const iph = ipHash(clientIp(req));
  const body = await readJson(req, loginSchema, 2048);
  const lower = body.username.toLowerCase();

  // Brute-force protection: per network, and per target account (so distributed guessing is also slowed).
  await enforce("login-ip", iph, 20, 900, "Too many sign-in attempts. Try again in a few minutes.");
  await enforce("login-user", lower.slice(0, 64), 8, 900, "Too many sign-in attempts. Try again in a few minutes.");

  const rows = await sql<
    { id: string; password_hash: string; is_banned: boolean; ban_reason: string | null; ban_expires_at: Date | null }[]
  >`select id, password_hash, is_banned, ban_reason, ban_expires_at from users where username_lower = ${lower}`;
  const user = rows[0];

  if (!user) {
    await fakeVerify(body.password);
    throw new HttpError(401, "Incorrect username or password.");
  }
  if (!(await verifyPassword(body.password, user.password_hash))) {
    throw new HttpError(401, "Incorrect username or password.");
  }

  const banActive = user.is_banned && (!user.ban_expires_at || user.ban_expires_at > new Date());
  if (banActive) {
    const until = user.ban_expires_at ? ` until ${user.ban_expires_at.toUTCString()}` : " permanently";
    throw new HttpError(
      403,
      `This account is suspended${until}.${user.ban_reason ? ` Reason: ${user.ban_reason}` : ""}`,
      "banned",
    );
  }

  await sql`update users set last_login_at = now(), last_ip_hash = ${iph} where id = ${user.id}`;
  await createSession(user.id, iph, req.headers.get("user-agent"));
  return json({ ok: true });
});
