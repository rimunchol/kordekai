import { route, json, readJson } from "@/lib/http";
import { settingsSchema } from "@/lib/validation";
import { getSession, requireUser } from "@/lib/session";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export const GET = route(async () => {
  const user = await getSession();
  if (!user) return json({ user: null }, { status: 401 });
  return json({
    user: {
      username: user.username,
      isDeveloper: user.isDeveloper,
      theme: user.theme,
      customInstructions: user.customInstructions,
    },
  });
});

export const PATCH = route(async (req) => {
  const user = await requireUser();
  const body = await readJson(req, settingsSchema, 4096);
  await sql`
    update users set
      theme = coalesce(${body.theme ?? null}, theme),
      custom_instructions = coalesce(${body.customInstructions ?? null}, custom_instructions)
    where id = ${user.id}`;
  return json({ ok: true });
});
