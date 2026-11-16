-- KordekAI schema. Idempotent: safe to run repeatedly (npm run db:migrate).

create table if not exists users (
  id                  uuid primary key default gen_random_uuid(),
  username            text not null,
  username_lower      text not null unique,
  password_hash       text not null,
  role                text not null default 'user' check (role in ('user', 'admin')),
  theme               text not null default 'dark' check (theme in ('dark', 'light', 'system')),
  custom_instructions text not null default '',
  signup_ip_hash      text,            -- HMAC of the signup IP, never the raw address
  last_ip_hash        text,
  is_banned           boolean not null default false,
  ban_reason          text,
  ban_expires_at      timestamptz,     -- null + is_banned = permanent
  created_at          timestamptz not null default now(),
  last_login_at       timestamptz
);
create index if not exists users_created_idx on users (created_at desc);
create index if not exists users_signup_ip_idx on users (signup_ip_hash);

create table if not exists sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users (id) on delete cascade,
  token_hash  text not null unique,
  ip_hash     text,
  user_agent  text,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index if not exists sessions_user_idx on sessions (user_id);

create table if not exists conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users (id) on delete cascade,
  title       text not null default 'New chat',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists conversations_user_updated_idx on conversations (user_id, updated_at desc);

create table if not exists messages (
  id               uuid primary key default gen_random_uuid(),
  seq              bigserial,
  conversation_id  uuid not null references conversations (id) on delete cascade,
  role             text not null check (role in ('user', 'assistant')),
  content          text not null,
  status           text not null default 'complete' check (status in ('complete', 'stopped', 'error')),
  created_at       timestamptz not null default now()
);
create index if not exists messages_conv_seq_idx on messages (conversation_id, seq);

-- Ban history (kept even if the account is later removed).
create table if not exists bans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users (id) on delete set null,
  username    text not null,
  reason      text not null,
  banned_by   text not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz,
  lifted_at   timestamptz,
  lifted_by   text
);
create index if not exists bans_user_idx on bans (user_id, created_at desc);

-- Network-level signup restrictions. Always temporary by design (shared / dynamic IPs).
create table if not exists ip_bans (
  ip_hash      text primary key,
  reason       text not null,
  source_user  text,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null
);

create table if not exists app_settings (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);

create table if not exists request_logs (
  id          bigserial primary key,
  user_id     uuid,
  kind        text not null default 'chat',
  status      text not null check (status in ('ok', 'error', 'aborted')),
  model       text,
  error       text,
  latency_ms  integer,
  created_at  timestamptz not null default now()
);
create index if not exists request_logs_created_idx on request_logs (created_at desc);
create index if not exists request_logs_status_idx on request_logs (status, created_at desc);

-- Fixed-window counters used when Upstash isn't configured.
create table if not exists rate_limits (
  key       text primary key,
  count     integer not null,
  reset_at  timestamptz not null
);
create index if not exists rate_limits_reset_idx on rate_limits (reset_at);
