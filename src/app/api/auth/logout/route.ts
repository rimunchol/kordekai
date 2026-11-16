import { route, json, assertSameOrigin } from "@/lib/http";
import { destroySession } from "@/lib/session";

export const runtime = "nodejs";

export const POST = route(async (req) => {
  assertSameOrigin(req);
  await destroySession();
  return json({ ok: true });
});
