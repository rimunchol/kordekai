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
  get navyKey() {
    return required("NAVY_API_KEY");
  },
  get navyBaseUrl() {
    return (process.env.NAVY_BASE_URL || "https://api.navy/v1").replace(/\/$/, "");
  },
  get defaultModel() {
    return process.env.NAVY_MODEL || "gpt-4.1";
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
