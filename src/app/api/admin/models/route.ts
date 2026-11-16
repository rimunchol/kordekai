import { route, json } from "@/lib/http";
import { requireAdmin } from "@/lib/session";
import { listModels } from "@/lib/navy";

export const runtime = "nodejs";

export const GET = route(async () => {
  await requireAdmin();
  try {
    return json({ models: await listModels() });
  } catch {
    return json({ models: [], error: "Couldn't load models from Navy." });
  }
});
