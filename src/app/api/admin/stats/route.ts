import { route, json } from "@/lib/http";
import { requireAdmin } from "@/lib/session";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export const GET = route(async () => {
  await requireAdmin();
  const [totals] = await sql<Record<string, number>[]>`
    select
      (select count(*) from users)::int as users,
      (select count(*) from users where created_at > now() - interval '7 days')::int as users_7d,
      (select count(*) from users where is_banned and (ban_expires_at is null or ban_expires_at > now()))::int as banned,
      (select count(*) from conversations)::int as conversations,
      (select count(*) from messages)::int as messages,
      (select count(*) from request_logs where created_at > now() - interval '24 hours')::int as requests_24h,
      (select count(*) from request_logs where created_at > now() - interval '24 hours' and status = 'error')::int as errors_24h,
      (select coalesce(avg(latency_ms), 0) from request_logs where created_at > now() - interval '24 hours' and status = 'ok')::int as avg_latency_ms`;
  const daily = await sql<{ day: string; total: number; errors: number }[]>`
    select to_char(d, 'YYYY-MM-DD') as day,
           count(r.id)::int as total,
           count(r.id) filter (where r.status = 'error')::int as errors
    from generate_series(current_date - 6, current_date, interval '1 day') d
    left join request_logs r on r.created_at >= d and r.created_at < d + interval '1 day'
    group by d order by d`;
  const errors = await sql<{ created_at: Date; model: string | null; error: string | null; username: string | null }[]>`
    select r.created_at, r.model, r.error, u.username
    from request_logs r left join users u on u.id = r.user_id
    where r.status = 'error' order by r.created_at desc limit 20`;
  return json({
    totals,
    daily,
    errors: errors.map((e) => ({ at: e.created_at.toISOString(), model: e.model, error: e.error, username: e.username })),
  });
});
