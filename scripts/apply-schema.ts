/**
 * Applies prisma/turso-schema.sql to the Turso (libSQL) database.
 *
 * Usage (run from the project root):
 *   DATABASE_URL="libsql://your-db.turso.io" \
 *   DATABASE_AUTH_TOKEN="your-token" \
 *   bun scripts/apply-schema.ts
 *
 * Safe to re-run on an EMPTY database only — it creates tables.
 * Uses CREATE TABLE without IF NOT EXISTS, so a second run on a filled DB
 * will fail with "table already exists" (which is fine — schema is applied).
 */
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const url = process.env.DATABASE_URL;
if (!url || !/^(libsql|file|https?):/.test(url)) {
  console.error(
    "✗ DATABASE_URL must be set to a Turso/libSQL URL (libsql://...).\n" +
      "  Example: DATABASE_URL=\"libsql://gymshift-yourname.turso.io\" DATABASE_AUTH_TOKEN=\"...\" bun scripts/apply-schema.ts",
  );
  process.exit(1);
}
if (!url.startsWith("libsql:") && !url.startsWith("http")) {
  console.log("ℕ Примечание: это локальный file:-тест (на проде будет libsql://...)");
}

const authToken = process.env.DATABASE_AUTH_TOKEN ?? undefined;

const sql = readFileSync(join(process.cwd(), "prisma", "turso-schema.sql"), "utf8");

// Split the dump into individual statements (prisma emits `-- stmt\n...;` blocks).
const statements = sql
  .split(";")
  .map((s) => s.replace(/^--[^\n]*\n/gm, "").trim())
  .filter((s) => s.length > 0);

const client = createClient({ url, authToken });

console.log(`→ Applying ${statements.length} statements to ${url} ...`);

try {
  for (const [i, stmt] of statements.entries()) {
    await client.execute(stmt);
    console.log(`  ✓ [${i + 1}/${statements.length}] ${stmt.split("\n")[0].slice(0, 60)}`);
  }
  console.log("✓ Schema applied — база GymShift готова на Turso.");
} catch (e) {
  console.error("✗ Failed:", e instanceof Error ? e.message : e);
  process.exit(1);
} finally {
  client.close();
}
