import postgres from "postgres";
import { env } from "./env";

type Sql = ReturnType<typeof postgres>;

const globalForDb = globalThis as unknown as { __sql?: Sql };

// One small pool per serverless instance. `prepare: false` keeps this compatible with
// transaction poolers (PgBouncer / Neon pooled / Supabase pooler).
function connect(): Sql {
  const url = env.databaseUrl;
  const local = /@(localhost|127\.0\.0\.1)/.test(url);
  return postgres(url, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    ssl: local ? false : "require",
    onnotice: () => {},
  });
}

export function db(): Sql {
  if (!globalForDb.__sql) globalForDb.__sql = connect();
  return globalForDb.__sql;
}

// Tagged-template proxy so call sites can write: await sql`select ...`
export const sql = ((strings: TemplateStringsArray, ...values: unknown[]) =>
  (db() as unknown as (s: TemplateStringsArray, ...v: unknown[]) => unknown)(strings, ...values)) as unknown as Sql;
Object.defineProperty(sql, "unsafe", { get: () => db().unsafe.bind(db()) });
Object.defineProperty(sql, "begin", { get: () => db().begin.bind(db()) });
