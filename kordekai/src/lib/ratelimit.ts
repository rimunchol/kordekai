import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { sql } from "./db";
import { HttpError } from "./http";

/**
 * Rate limiting.
 *  - With UPSTASH_REDIS_REST_URL/TOKEN (or Vercel's KV_REST_API_*), a managed sliding window is used.
 *  - Otherwise a Postgres fixed-window counter is used, so it still works on serverless.
 * Application-level limits complement, but don't replace, Vercel's platform DDoS mitigation
 * and the Vercel Firewall (see README).
 */

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;
const limiters = new Map<string, Ratelimit>();

export type LimitResult = { ok: boolean; retryAfter: number };

export async function checkLimit(name: string, id: string, max: number, windowSec: number): Promise<LimitResult> {
  try {
    if (redis) {
      const k = `${name}:${max}:${windowSec}`;
      let rl = limiters.get(k);
      if (!rl) {
        rl = new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(max, `${windowSec} s`),
          prefix: `kordekai:${name}`,
        });
        limiters.set(k, rl);
      }
      const res = await rl.limit(id);
      return { ok: res.success, retryAfter: Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)) };
    }

    const key = `${name}:${id}`;
    const rows = await sql<{ count: number; ttl: number }[]>`
      insert into rate_limits (key, count, reset_at)
      values (${key}, 1, now() + make_interval(secs => ${windowSec}))
      on conflict (key) do update set
        count = case when rate_limits.reset_at <= now() then 1 else rate_limits.count + 1 end,
        reset_at = case when rate_limits.reset_at <= now() then excluded.reset_at else rate_limits.reset_at end
      returning count, greatest(1, ceil(extract(epoch from (reset_at - now()))))::int as ttl`;
    if (Math.random() < 0.01) void sql`delete from rate_limits where reset_at < now() - interval '1 hour'`.catch(() => {});
    return { ok: rows[0].count <= max, retryAfter: rows[0].ttl };
  } catch (err) {
    // A limiter outage shouldn't take the whole product down.
    console.error("[ratelimit] failing open:", err);
    return { ok: true, retryAfter: 0 };
  }
}

export async function enforce(name: string, id: string, max: number, windowSec: number, message?: string) {
  const res = await checkLimit(name, id, max, windowSec);
  if (!res.ok) {
    throw new HttpError(429, message ?? "Too many requests. Please slow down.", "rate_limited", {
      "Retry-After": String(res.retryAfter),
    });
  }
}
