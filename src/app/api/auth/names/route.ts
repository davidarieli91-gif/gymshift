import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/names -> {names: string[]}
 * Public (no token): the login screen offers the registered trainer names
 * as one-tap suggestions so nobody fails to log in over a name typo.
 * Only names are exposed — never PIN hashes or phones.
 */
export async function GET() {
  const rows = await db.trainer.findMany({
    orderBy: { createdAt: "asc" },
    select: { name: true },
  });
  return NextResponse.json({ names: rows.map((r) => r.name) });
}
