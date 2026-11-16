import { route, json, assertUuid, assertSameOrigin, HttpError } from "@/lib/http";
import { requireAdmin } from "@/lib/session";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export const DELETE = route<{ id: string }>(async (req, ctx) => {
  assertSameOrigin(req);
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  assertUuid(id);
  if (id === admin.id) throw new HttpError(400, "You can't remove your own account.");
  const rows = await sql`delete from users where id = ${id} returning id`;
  if (!rows.length) throw new HttpError(404, "User not found.");
  return json({ ok: true });
});
