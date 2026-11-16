import { route, json } from "@/lib/http";
import { requireAdmin } from "@/lib/session";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export const GET = route(async (req) => {
  await requireAdmin();
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 40);
  const rows = await sql<
    {
      id: string; username: string; role: string; created_at: Date; last_login_at: Date | null;
      is_banned: boolean; ban_reason: string | null; ban_expires_at: Date | null; conversations: number;
    }[]
  >`
    select u.id, u.username, u.role, u.created_at, u.last_login_at, u.is_banned, u.ban_reason, u.ban_expires_at,
           (select count(*) from conversations c where c.user_id = u.id)::int as conversations
    from users u
    where ${q} = '' or starts_with(u.username_lower, ${q})
    order by u.created_at desc limit 100`;
  const now = new Date();
  return json({
    users: rows.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      createdAt: u.created_at.toISOString(),
      lastLoginAt: u.last_login_at?.toISOString() ?? null,
      status: u.is_banned && (!u.ban_expires_at || u.ban_expires_at > now) ? "banned" : "active",
      banReason: u.ban_reason,
      banExpiresAt: u.ban_expires_at?.toISOString() ?? null,
      conversations: u.conversations,
    })),
  });
});
