import { NextRequest, NextResponse } from "next/server";
import type { ZodType } from "zod";
import { env } from "./env";
import { hmac } from "./crypto";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public headers?: Record<string, string>,
  ) {
    super(message);
  }
}

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, { ...init, headers: { "Cache-Control": "no-store", ...init?.headers } });
}

type Ctx<P> = { params: Promise<P> };

/** Wraps a route handler: uniform JSON errors, no stack traces leaked to clients. */
export function route<P = Record<string, never>>(
  fn: (req: NextRequest, ctx: Ctx<P>) => Promise<Response>,
) {
  return async (req: NextRequest, ctx: Ctx<P>): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) {
        return json({ error: err.message, code: err.code }, { status: err.status, headers: err.headers });
      }
      console.error("[api]", req.method, req.nextUrl.pathname, err);
      return json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}

/** Client IP. Forwarded headers are only trusted when running behind Vercel (or TRUST_PROXY=true). */
export function clientIp(req: Request): string {
  if (!env.trustProxy) return "direct";
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "unknown";
}

export const ipHash = (ip: string) => hmac(ip, "ip");

/** CSRF defence in depth (cookies are also SameSite=Lax): mutating requests must be same-origin. */
export function assertSameOrigin(req: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) throw new HttpError(403, "Cross-site request blocked.");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError(403, "Cross-site request blocked.");
  }
  if (originHost !== host) throw new HttpError(403, "Cross-site request blocked.");
}

/** Reads and validates a JSON body with a hard byte cap (default 32 KB). */
export async function readJson<T>(req: Request, schema: ZodType<T>, maxBytes = 32_768): Promise<T> {
  assertSameOrigin(req);
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new HttpError(413, "Request too large.");
  if (!req.headers.get("content-type")?.includes("application/json")) {
    throw new HttpError(415, "Expected application/json.");
  }
  const text = await req.text();
  if (Buffer.byteLength(text) > maxBytes) throw new HttpError(413, "Request too large.");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new HttpError(400, "Malformed JSON.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid request.");
  }
  return parsed.data;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function assertUuid(id: string) {
  if (!UUID_RE.test(id)) throw new HttpError(404, "Not found.");
}
