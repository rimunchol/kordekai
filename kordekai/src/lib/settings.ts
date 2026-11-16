import { sql } from "./db";
import { env } from "./env";

export const DEFAULT_SYSTEM_PROMPT = `You are KordekAI, a helpful, accurate and concise AI assistant.

- Answer directly. Lead with the answer, then add detail only where it helps.
- Use Markdown sparingly: short paragraphs, lists for steps or comparisons, tables only for real tabular data, fenced code blocks (with a language) for code.
- Use bold for key terms, not for whole sentences. Avoid large headings in short answers.
- Use LaTeX ($...$ inline, $$...$$ block) for mathematics.
- If you're unsure or lack information, say so plainly instead of guessing.
- Match the user's language and level of expertise.`;

export async function getSetting(key: string): Promise<string | null> {
  const rows = await sql<{ value: string }[]>`select value from app_settings where key = ${key}`;
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  await sql`
    insert into app_settings (key, value) values (${key}, ${value})
    on conflict (key) do update set value = excluded.value, updated_at = now()`;
}

/** Always read fresh, so edits from the developer dashboard apply to the very next request. */
export async function getAiConfig(): Promise<{ systemPrompt: string; model: string }> {
  const rows = await sql<{ key: string; value: string }[]>`
    select key, value from app_settings where key in ('system_prompt', 'model')`;
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    systemPrompt: map.system_prompt || DEFAULT_SYSTEM_PROMPT,
    model: map.model || env.defaultModel,
  };
}
