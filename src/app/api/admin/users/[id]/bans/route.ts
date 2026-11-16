import { route, json, assertUuid } from "@/lib/http";
import { requireAdmin } from "@/lib/session";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export const GET = route<{ id: string }>(async (_req, ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;
  assertUuid(id);
  const rows = await sql<
    { id: string; reason: string; banned_by: string; created_at: Date; expires_at: Date | null; lifted_at: Date | null; lifted_by: string | null }[]
  >`select id, reason, banned_by, created_at, expires_at, lifted_at, lifted_by
    from bans where user_id = ${id} order by created_at desc limit 50`;
  return json({
    bans: rows.map((b) => ({
      id: b.id,
      reason: b.reason,
      bannedBy: b.banned_by,
      createdAt: b.created_at.toISOString(),
      expiresAt: b.expires_at?.toISOString() ?? null,
      liftedAt: b.lifted_at?.toISOString() ?? null,
      liftedBy: b.lifted_by,
    })),
  });
});
