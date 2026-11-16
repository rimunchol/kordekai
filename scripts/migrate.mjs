import postgres from "postgres";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
const schema = readFileSync(fileURLToPath(new URL("../db/schema.sql", import.meta.url)), "utf8");

try {
  await sql.unsafe(schema);
  console.log("Schema is up to date.");
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
