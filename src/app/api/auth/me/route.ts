import { NextRequest, NextResponse } from "next/server";
import { requireTrainer } from "@/lib/auth";
import { publicTrainer } from "../../_helpers";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me -> {trainer} | 200 {trainer: null}
 * Always 200: a missing/expired token is a normal "logged out" state for the
 * client, not an error — this keeps the browser console free of 401 noise
 * when the app opens with a stale token (e.g. after a DB reset).
 */
export async function GET(req: NextRequest) {
  const trainer = await requireTrainer(req);
  if (!trainer) return NextResponse.json({ trainer: null });
  return NextResponse.json({ trainer: publicTrainer(trainer) });
}
