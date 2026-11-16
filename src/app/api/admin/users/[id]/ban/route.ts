import { route, json, readJson, assertUuid, assertSameOrigin, HttpError } from "@/lib/http";
import { banSchema } from "@/lib/validation";
import { requireAdmin } from "@/lib/session";
import { sql } from "@/lib/db";
import { banUser, unbanUser } from "@/lib/accounts";

export const runtime = "nodejs";

export const POST = route<{ id: string }>(async (req, ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  assertUuid(id);
  const body = await readJson(req, banSchema, 2048);
  if (id === admin.id) throw new HttpError(400, "You can't ban your own account.");
  const rows = await sql<{ username: string; role: string }[]>`select username, role from users where id = ${id}`;
  if (!rows[0]) throw new HttpError(404, "User not found.");
  if (rows[0].role === "admin") throw new HttpError(400, "Admin accounts can't be banned.");
  await banUser({
    userId: id,
    username: rows[0].username,
    reason: body.reason,
    by: admin.username,
    durationHours: body.durationHours,
    restrictSignups: body.restrictSignups,
    restrictDays: body.restrictDays,
  });
  return json({ ok: true });
});

export const DELETE = route<{ id: string }>(async (req, ctx) => {
  assertSameOrigin(req);
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  assertUuid(id);
  await unbanUser(id, admin.username);
  return json({ ok: true });
});
