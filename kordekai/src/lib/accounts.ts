import { sql } from "./db";

export type BanInput = {
  userId: string;
  username: string;
  reason: string;
  by: string;
  durationHours: number | null;
  restrictSignups: boolean;
  restrictDays: number;
};

/** Bans an account, records history, kills its sessions, and optionally restricts signups from its network. */
export async function banUser(b: BanInput) {
  await sql.begin(async (tx) => {
    const expires = b.durationHours ? new Date(Date.now() + b.durationHours * 3600_000) : null;
    await tx`
      update users set is_banned = true, ban_reason = ${b.reason}, ban_expires_at = ${expires}
      where id = ${b.userId}`;
    await tx`
      update bans set lifted_at = now(), lifted_by = 'superseded'
      where user_id = ${b.userId} and lifted_at is null`;
    await tx`
      insert into bans (user_id, username, reason, banned_by, expires_at)
      values (${b.userId}, ${b.username}, ${b.reason}, ${b.by}, ${expires})`;
    await tx`delete from sessions where user_id = ${b.userId}`;
    if (b.restrictSignups) {
      // Temporary on purpose: shared and dynamic IPs mean permanent IP bans hit innocent people.
      await tx`
        insert into ip_bans (ip_hash, reason, source_user, expires_at)
        select distinct h, ${b.reason}, ${b.username}, now() + make_interval(days => ${b.restrictDays})
        from (
          select signup_ip_hash as h from users where id = ${b.userId}
          union select last_ip_hash from users where id = ${b.userId}
        ) x
        where h is not null and h <> ''
        on conflict (ip_hash) do update set expires_at = greatest(ip_bans.expires_at, excluded.expires_at)`;
    }
  });
}

export async function unbanUser(userId: string, by: string) {
  await sql.begin(async (tx) => {
    await tx`update users set is_banned = false, ban_reason = null, ban_expires_at = null where id = ${userId}`;
    await tx`update bans set lifted_at = now(), lifted_by = ${by} where user_id = ${userId} and lifted_at is null`;
  });
}
