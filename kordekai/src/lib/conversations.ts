import { sql } from "./db";

export type ConversationSummary = { id: string; title: string; updatedAt: string };
export type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "complete" | "stopped" | "error";
};

export async function listConversations(userId: string, limit = 200): Promise<ConversationSummary[]> {
  const rows = await sql<{ id: string; title: string; updated_at: Date }[]>`
    select id, title, updated_at from conversations
    where user_id = ${userId} order by updated_at desc limit ${limit}`;
  return rows.map((r) => ({ id: r.id, title: r.title, updatedAt: r.updated_at.toISOString() }));
}

export async function getConversationWithMessages(userId: string, id: string) {
  const conv = await sql<{ id: string; title: string }[]>`
    select id, title from conversations where id = ${id} and user_id = ${userId}`;
  if (!conv[0]) return null;
  const messages = await sql<StoredMessage[]>`
    select id, role, content, status from messages where conversation_id = ${id} order by seq asc`;
  return { conversation: conv[0], messages: [...messages] };
}

export function titleFromMessage(message: string): string {
  const clean = message.replace(/\s+/g, " ").replace(/[#*`>_]/g, "").trim();
  if (clean.length <= 48) return clean || "New chat";
  const cut = clean.slice(0, 48);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 24 ? cut.slice(0, lastSpace) : cut) + "…";
}
