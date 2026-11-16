import { route, json, readJson, assertUuid, assertSameOrigin, HttpError } from "@/lib/http";
import { renameSchema } from "@/lib/validation";
import { requireUser } from "@/lib/session";
import { sql } from "@/lib/db";
import { getConversationWithMessages } from "@/lib/conversations";

export const runtime = "nodejs";

export const GET = route<{ id: string }>(async (_req, ctx) => {
  const { id } = await ctx.params;
  assertUuid(id);
  const user = await requireUser();
  const data = await getConversationWithMessages(user.id, id);
  if (!data) throw new HttpError(404, "Conversation not found.");
  return json(data);
});

export const PATCH = route<{ id: string }>(async (req, ctx) => {
  const { id } = await ctx.params;
  assertUuid(id);
  const user = await requireUser();
  const { title } = await readJson(req, renameSchema, 1024);
  const rows = await sql`update conversations set title = ${title} where id = ${id} and user_id = ${user.id} returning id`;
  if (!rows.length) throw new HttpError(404, "Conversation not found.");
  return json({ ok: true, title });
});

export const DELETE = route<{ id: string }>(async (req, ctx) => {
  assertSameOrigin(req);
  const { id } = await ctx.params;
  assertUuid(id);
  const user = await requireUser();
  const rows = await sql`delete from conversations where id = ${id} and user_id = ${user.id} returning id`;
  if (!rows.length) throw new HttpError(404, "Conversation not found.");
  return json({ ok: true });
});
