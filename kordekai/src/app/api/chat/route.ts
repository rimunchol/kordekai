import { after } from "next/server";
import { route, readJson, clientIp, ipHash, HttpError } from "@/lib/http";
import { chatSchema } from "@/lib/validation";
import { enforce } from "@/lib/ratelimit";
import { requireUser } from "@/lib/session";
import { sql } from "@/lib/db";
import { getAiConfig } from "@/lib/settings";
import { titleFromMessage } from "@/lib/conversations";
import { openChatStream, readContentDeltas, type ChatMessage } from "@/lib/cerebras";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MAX_HISTORY_MESSAGES = 40;
const MAX_HISTORY_CHARS = 60_000;

const encoder = new TextEncoder();
const sse = (obj: unknown) => encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);

export const POST = route(async (req) => {
  const user = await requireUser();
  const iph = ipHash(clientIp(req));
  await enforce("api-ip", iph, 120, 60);
  await enforce("chat-user-min", user.id, 15, 60, "You're sending messages too quickly. Please wait a moment.");
  await enforce("chat-user-day", user.id, 500, 86400, "Daily message limit reached. Try again tomorrow.");

  const body = await readJson(req, chatSchema, 16_384);

  // Resolve or create the conversation (ownership is enforced in SQL).
  let conversationId = body.conversationId;
  let title: string | null = null;
  if (conversationId) {
    const rows = await sql<{ title: string }[]>`
      select title from conversations where id = ${conversationId} and user_id = ${user.id}`;
    if (!rows[0]) throw new HttpError(404, "Conversation not found.");
  } else {
    title = titleFromMessage(body.message);
    const rows = await sql<{ id: string }[]>`
      insert into conversations (user_id, title) values (${user.id}, ${title}) returning id`;
    conversationId = rows[0].id;
  }

  await sql`insert into messages (conversation_id, role, content) values (${conversationId}, 'user', ${body.message})`;
  await sql`update conversations set updated_at = now() where id = ${conversationId}`;

  // Recent history, newest first, trimmed to a budget, then restored to chronological order.
  const recent = await sql<{ role: "user" | "assistant"; content: string }[]>`
    select role, content from messages
    where conversation_id = ${conversationId} and not (role = 'assistant' and content = '')
    order by seq desc limit ${MAX_HISTORY_MESSAGES}`;
  const history: ChatMessage[] = [];
  let chars = 0;
  for (const m of recent) {
    chars += m.content.length;
    if (chars > MAX_HISTORY_CHARS && history.length > 0) break;
    history.unshift({ role: m.role, content: m.content });
  }

  const cfg = await getAiConfig();
  let system = `${cfg.systemPrompt}\n\nCurrent date: ${new Date().toISOString().slice(0, 10)}.`;
  if (user.customInstructions.trim()) {
    system += `\n\nThe user has set these personal response preferences (follow them unless they conflict with the rules above):\n${user.customInstructions.trim()}`;
  }

  const upstreamAbort = new AbortController();
  const onAbort = () => upstreamAbort.abort();
  req.signal.addEventListener("abort", onAbort);
  const timeout = setTimeout(() => upstreamAbort.abort(new Error("timeout")), 55_000);

  const convId = conversationId;
  const startedAt = Date.now();
  let finish!: () => void;
  const finished = new Promise<void>((r) => (finish = r));
  after(() => finished); // keep the function alive until the answer is persisted

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let content = "";
      let status: "ok" | "error" | "aborted" = "ok";
      let errorMessage: string | null = null;
      const send = (obj: unknown) => {
        try {
          controller.enqueue(sse(obj));
        } catch {} // client went away
      };

      send({ t: "meta", conversationId: convId, title });
      try {
        const upstream = await openChatStream(cfg.model, [{ role: "system", content: system }, ...history], upstreamAbort.signal);
        for await (const delta of readContentDeltas(upstream)) {
          content += delta;
          send({ t: "delta", v: delta });
        }
        if (!content.trim()) throw new Error("The model returned an empty response.");
      } catch (err) {
        if (upstreamAbort.signal.aborted) {
          const timedOut = (upstreamAbort.signal.reason as Error | undefined)?.message === "timeout";
          status = timedOut ? "error" : "aborted";
          errorMessage = timedOut ? "The response took too long and was cut off." : null;
        } else {
          status = "error";
          errorMessage = err instanceof Error ? err.message : "Unknown error";
          console.error("[chat] upstream failure:", errorMessage);
        }
      }

      try {
        let messageId: string | null = null;
        if (content.trim()) {
          const rows = await sql<{ id: string }[]>`
            insert into messages (conversation_id, role, content, status)
            values (${convId}, 'assistant', ${content}, ${status === "ok" ? "complete" : status === "aborted" ? "stopped" : "error"})
            returning id`;
          messageId = rows[0].id;
          await sql`update conversations set updated_at = now() where id = ${convId}`;
        }
        await sql`
          insert into request_logs (user_id, kind, status, model, error, latency_ms)
          values (${user.id}, 'chat', ${status}, ${cfg.model}, ${errorMessage?.slice(0, 500) ?? null}, ${Date.now() - startedAt})`;
        if (status === "error") {
          send({ t: "error", message: "The AI service had a problem generating a response. Please try again.", partial: Boolean(content) });
        }
        send({ t: "done", messageId, status });
      } catch (err) {
        console.error("[chat] persist failure:", err);
        send({ t: "error", message: "Your response could not be saved." });
      } finally {
        clearTimeout(timeout);
        req.signal.removeEventListener("abort", onAbort);
        try {
          controller.close();
        } catch {}
        finish();
      }
    },
    cancel() {
      upstreamAbort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
