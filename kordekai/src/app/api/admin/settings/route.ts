import { route, json, readJson } from "@/lib/http";
import { aiSettingsSchema } from "@/lib/validation";
import { requireAdmin } from "@/lib/session";
import { getAiConfig, setSetting, DEFAULT_SYSTEM_PROMPT } from "@/lib/settings";

export const runtime = "nodejs";

export const GET = route(async () => {
  await requireAdmin();
  return json({ ...(await getAiConfig()), defaultSystemPrompt: DEFAULT_SYSTEM_PROMPT });
});

export const PUT = route(async (req) => {
  await requireAdmin();
  const body = await readJson(req, aiSettingsSchema, 16_384);
  await setSetting("system_prompt", body.systemPrompt);
  await setSetting("model", body.model);
  return json({ ok: true });
});
