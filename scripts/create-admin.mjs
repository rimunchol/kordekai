// Creates (or resets the password of) the developer account named by DEVELOPER_USERNAME.
// Usage: ADMIN_PASSWORD='a-long-passphrase' npm run admin:create
import postgres from "postgres";
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const { DATABASE_URL, DEVELOPER_USERNAME, ADMIN_PASSWORD } = process.env;

if (!DATABASE_URL || !DEVELOPER_USERNAME || !ADMIN_PASSWORD) {
  console.error("Set DATABASE_URL, DEVELOPER_USERNAME and ADMIN_PASSWORD.");
  process.exit(1);
}
if (ADMIN_PASSWORD.length < 12) {
  console.error("ADMIN_PASSWORD must be at least 12 characters.");
  process.exit(1);
}
if (!/^[A-Za-z0-9_]{3,24}$/.test(DEVELOPER_USERNAME)) {
  console.error("DEVELOPER_USERNAME must be 3-24 characters: letters, numbers, underscore.");
  process.exit(1);
}

// Must stay in sync with src/lib/crypto.ts
const N = 16384, r = 8, p = 1, KEYLEN = 64;
const salt = randomBytes(16);
const hash = await scryptAsync(ADMIN_PASSWORD, salt, KEYLEN, { N, r, p });
const encoded = `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${hash.toString("base64")}`;

const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });
try {
  const lower = DEVELOPER_USERNAME.toLowerCase();
  const rows = await sql`
    insert into users (username, username_lower, password_hash, role)
    values (${DEVELOPER_USERNAME}, ${lower}, ${encoded}, 'admin')
    on conflict (username_lower)
    do update set password_hash = excluded.password_hash, role = 'admin', is_banned = false, ban_expires_at = null
    returning id`;
  await sql`delete from sessions where user_id = ${rows[0].id}`;
  console.log(`Developer account "${DEVELOPER_USERNAME}" is ready.`);
} catch (err) {
  console.error("Failed:", err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
