import { NextResponse } from "next/server";

/**
 * TEMPORARY production diagnostic (remove after debugging).
 * Reports which env vars are PRESENT (names/lengths only — never values)
 * and tries both DB access paths, returning the raw error messages.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.DATABASE_URL ?? "";
  const token = process.env.DATABASE_AUTH_TOKEN ?? "";
  const diag: Record<string, unknown> = {
    node: process.version,
    hasDbUrl: url.length > 0,
    urlPrefix: url.slice(0, 40),
    hasToken: token.length > 0,
    tokenLen: token.length,
    hasAuthSecret: Boolean(process.env.AUTH_SECRET),
  };

  try {
    const { createClient } = await import("@libsql/client");
    const c = createClient({ url, authToken: token || undefined });
    const r = await c.execute("SELECT COUNT(*) AS n FROM Trainer");
    diag.rawLibsql = { ok: true, trainers: r.rows[0]?.n };
    c.close();
  } catch (e) {
    diag.rawLibsql = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  try {
    const { db } = await import("@/lib/db");
    const n = await db.trainer.count();
    diag.prismaAdapter = { ok: true, trainers: n };
  } catch (e) {
    diag.prismaAdapter = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  return NextResponse.json(diag);
}
