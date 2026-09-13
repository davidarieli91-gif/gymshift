import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** GET /api — health check. */
export async function GET() {
  return NextResponse.json({ ok: true, service: "gymshift" });
}
