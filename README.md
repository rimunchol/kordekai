# KordekAI

A minimal, fast AI chat platform: Next.js (App Router) + TypeScript + Tailwind, PostgreSQL, Navy API inference, deployable on Vercel.

## Setup

1. **Install**: `npm install`
2. **Environment**: copy `.env.example` to `.env.local` and fill in:
   | Variable | Purpose |
   |---|---|
   | `NAVY_API_KEY` | Your Navy API key (`sk-navy-…`). Server-only. |
   | `DATABASE_URL` | Any Postgres (Neon, Supabase, Vercel Postgres). Use the pooled URL on Vercel. |
   | `AUTH_SECRET` | 32+ random chars (`openssl rand -base64 48`). Signs session and IP hashes. |
   | `DEVELOPER_USERNAME` | Your admin username. Reserved: nobody can self-register it. |
   | `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Optional but recommended: managed rate limiting. Falls back to Postgres counters. |
   | `NAVY_MODEL` | Optional default model, defaults to `gpt-4.1` (changeable later in the dashboard). |
3. **Database**: `npm run db:migrate` (idempotent).
4. **Developer account**: `ADMIN_PASSWORD='a-long-passphrase' npm run admin:create` (12+ chars; re-run to reset the password).
5. **Run**: `npm run dev`, then open http://localhost:3000.

## Deploying to Vercel

Import the repo, add the environment variables above, run `npm run db:migrate` once against the production database, then run `npm run admin:create` once with the production `DATABASE_URL`. `/api/chat` has `maxDuration = 60`.

## How it works

- **Auth**: username + password (scrypt hashes). Sessions are random tokens stored hashed in Postgres and sent in an `HttpOnly`, `SameSite=Lax`, `Secure` (`__Host-` prefixed in production) cookie. Every request re-checks the database, so bans and logouts take effect immediately.
- **Admin**: `isDeveloper` is true only when the DB role is `admin` **and** the username equals `DEVELOPER_USERNAME`. Every `/api/admin/*` route and the `/admin` page check this server-side; others get 403/404.
- **Streaming**: `/api/chat` calls the Navy API (`stream: true`), forwards only answer text as SSE, saves the finished message, and saves partial output if the user presses Stop. Reasoning tokens from reasoning models are discarded, never shown or stored.
- **System prompt**: stored in `app_settings`, read fresh on every request. Per-user "chat preferences" are appended after it.
- **Bans**: account bans (permanent or timed, with reason and history) end sessions at once. Optionally also block *new sign-ups* from that account's network for 1-30 days. IPs are stored only as keyed HMACs, never raw, and are never shown in the UI.

## Security notes

- Client IPs come from `x-real-ip` / `x-forwarded-for` only on Vercel (or `TRUST_PROXY=true`); elsewhere they're ignored so they can't be spoofed.
- Layered limits: registration (3/min, 8/hr, 30/day per IP), login (20/15 min per IP and 8/15 min per username), password change, chat (15/min and 500/day per user), plus a per-IP API ceiling on chat. Bodies are size-capped and validated with zod; mutating routes require same-origin.
- **Rate limiting in code is not DDoS protection.** On Vercel, also enable the Firewall / Attack Challenge Mode and add WAF rate-limit rules on `/api/auth/*` and `/api/chat`; Vercel's platform mitigation handles network-level floods.
- No email verification (no email provider is configured). Consider adding one, or a CAPTCHA such as Turnstile, if sign-up abuse becomes a problem.
- No Content-Security-Policy yet (Next.js needs nonce plumbing for that); other security headers are set in `next.config.ts`.

## Layout

```
db/schema.sql          schema (users, sessions, conversations, messages, bans, ip_bans, settings, logs)
scripts/               migrate.mjs, create-admin.mjs
src/lib/               env, db, crypto, session, http, ratelimit, navy, settings, accounts, conversations
src/app/api/           route handlers (auth, me, conversations, chat, admin/*)
src/app/               pages: (auth)/login|register, (app)/ chat, admin
src/components/        Chat, Sidebar, Composer, Markdown, ThinkingBubble, SettingsModal, AdminDashboard, ...
```
