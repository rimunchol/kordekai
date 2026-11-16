import { route, json } from "@/lib/http";
import { requireUser } from "@/lib/session";
import { listConversations } from "@/lib/conversations";

export const runtime = "nodejs";

export const GET = route(async () => {
  const user = await requireUser();
  return json({ conversations: await listConversations(user.id) });
});
