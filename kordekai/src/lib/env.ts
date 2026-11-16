// Server-only configuration. Values are read lazily so `next build` works without secrets.
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

export const env = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get authSecret() {
    const s = required("AUTH_SECRET");
    if (s.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters.");
    return s;
  },
  get cerebrasKey() {
    return required("CEREBRAS_API_KEY");
  },
  get cerebrasBaseUrl() {
    return (process.env.CEREBRAS_BASE_URL || "https://api.cerebras.ai/v1").replace(/\/$/, "");
  },
  get defaultModel() {
    return process.env.CEREBRAS_MODEL || "gpt-oss-120b";
  },
  get developerUsername() {
    return (process.env.DEVELOPER_USERNAME || "").trim().toLowerCase();
  },
  get trustProxy() {
    return Boolean(process.env.VERCEL) || process.env.TRUST_PROXY === "true";
  },
  get isProd() {
    return process.env.NODE_ENV === "production";
  },
};
