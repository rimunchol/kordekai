import { route, json, readJson, clientIp, ipHash, HttpError } from "@/lib/http";
import { registerSchema } from "@/lib/validation";
import { enforce } from "@/lib/ratelimit";
import { sql } from "@/lib/db";
import { env } from "@/lib/env";
import { hashPassword } from "@/lib/crypto";
import { createSession } from "@/lib/session";

export const runtime = "nodejs";

export const POST = route(async (req) => {
  const ip = clientIp(req);
  const iph = ipHash(ip);

  // Layered limits: a burst limit, an hourly limit and a daily ceiling. Hourly/daily are generous
  // enough for shared networks (schools, offices) but still stop scripted mass-signup.
  await enforce("reg-burst", iph, 3, 60);
  await enforce("reg-hour", iph, 8, 3600, "Too many sign-ups from this network. Try again later.");
  await enforce("reg-day", iph, 30, 86400, "Too many sign-ups from this network today.");

  const body = await readJson(req, registerSchema, 4096);
  if (body.website) {
    // Honeypot tripped: pretend success-ish delay, create nothing.
    await new Promise((r) => setTimeout(r, 800));
    throw new HttpError(400, "Could not create account.");
  }

  const lower = body.username.toLowerCase();
  if (lower === env.developerUsername || ["admin", "root", "system", "kordekai"].includes(lower)) {
    throw new HttpError(409, "That username is not available.");
  }
  if (body.password.toLowerCase().includes(lower)) {
    throw new HttpError(400, "Password must not contain your username.");
  }

  const blocked = await sql`select 1 from ip_bans where ip_hash = ${iph} and expires_at > now()`;
  if (blocked.length) {
    throw new HttpError(403, "New accounts can't be created from this network right now.", "ip_restricted");
  }

  const passwordHash = await hashPassword(body.password);
  const rows = await sql<{ id: string }[]>`
    insert into users (username, username_lower, password_hash, signup_ip_hash, last_ip_hash, last_login_at)
    values (${body.username}, ${lower}, ${passwordHash}, ${iph}, ${iph}, now())
    on conflict (username_lower) do nothing
    returning id`;
  if (!rows.length) throw new HttpError(409, "That username is already taken.");

  await createSession(rows[0].id, iph, req.headers.get("user-agent"));
  return json({ ok: true }, { status: 201 });
});
