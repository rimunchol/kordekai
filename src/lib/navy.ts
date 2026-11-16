import { env } from "./env";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export class UpstreamError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Opens a streaming chat completion (OpenAI-compatible SSE) against Navy. */
export async function openChatStream(model: string, messages: ChatMessage[], signal: AbortSignal) {
  const res = await fetch(`${env.navyBaseUrl}/chat/completions`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.navyKey}` },
    body: JSON.stringify({ model, messages, stream: true, temperature: 0.7, max_completion_tokens: 8192 }),
  });
  if (!res.ok || !res.body) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.message || body?.error?.message || "";
    } catch {}
    throw new UpstreamError(res.status, detail || `Navy returned HTTP ${res.status}`);
  }
  return res.body;
}

/**
 * Yields only the visible answer text. Reasoning models may also stream `delta.reasoning`;
 * that is deliberately discarded and never shown or stored.
 */
export async function* readContentDeltas(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;
        try {
          const chunk = JSON.parse(data);
          if (chunk?.error) throw new UpstreamError(500, chunk.error.message ?? "Upstream error");
          const text = chunk?.choices?.[0]?.delta?.content;
          if (typeof text === "string" && text) yield text;
        } catch (err) {
          if (err instanceof UpstreamError) throw err; // otherwise ignore a malformed keep-alive line
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function listModels(): Promise<string[]> {
  const res = await fetch(`${env.navyBaseUrl}/models`, {
    headers: { Authorization: `Bearer ${env.navyKey}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new UpstreamError(res.status, "Could not load the model list.");
  const data = await res.json();
  return (data?.data ?? []).map((m: { id: string }) => m.id).sort();
}
