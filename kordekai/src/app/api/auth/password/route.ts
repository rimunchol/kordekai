import { route, json, readJson, clientIp, ipHash, HttpError } from "@/lib/http";
import { changePasswordSchema } from "@/lib/validation";
import { enforce } from "@/lib/ratelimit";
import { requireUser } from "@/lib/session";
import { sql } from "@/lib/db";
import { hashPassword, verifyPassword, hmac } from "@/lib/crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export const POST = route(async (req) => {
  const user = await requireUser();
  await enforce("pw-change", user.id, 5, 900);
  await enforce("pw-change-ip", ipHash(clientIp(req)), 20, 900);
  const body = await readJson(req, changePasswordSchema, 2048);

  const rows = await sql<{ password_hash: string }[]>`select password_hash from users where id = ${user.id}`;
  if (!rows[0] || !(await verifyPassword(body.currentPassword, rows[0].password_hash))) {
    throw new HttpError(400, "Current password is incorrect.");
  }
  if (body.newPassword.toLowerCase().includes(user.username.toLowerCase())) {
    throw new HttpError(400, "Password must not contain your username.");
  }

  await sql`update users set password_hash = ${await hashPassword(body.newPassword)} where id = ${user.id}`;
  // Sign out every other device; keep this one.
  const jar = await cookies();
  const current = jar.get(env.isProd ? "__Host-kordek_session" : "kordek_session")?.value;
  await sql`delete from sessions where user_id = ${user.id} and token_hash <> ${current ? hmac(current, "session") : ""}`;
  return json({ ok: true });
});
