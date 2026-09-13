import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError, requireTrainer } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/changes?limit=50 (auth) -> {changes:[...]} newest first.
 * payload is returned as a parsed object; limit clamped to 1..100.
 *
 * Privacy: rows whose action is namespaced `personal.*` are PRIVATE
 * (owner-only) and are never returned to anyone. Personal-event routes must
 * not create such rows at all — this filter is a defence-in-depth barrier so
 * a future leak path can never expose private events through the feed or
 * the realtime broadcast (`changes:new` payloads mirror these entries).
 */
const PRIVATE_ACTION_RE = /^personal[.:_-]/i;

export async function GET(req: NextRequest) {
  const actor = await requireTrainer(req);
  if (!actor) return jsonError("unauthorized", 401);

  const rawLimit = Number(req.nextUrl.searchParams.get("limit") ?? 50);
  const limit = Math.min(
    100,
    Math.max(1, Number.isFinite(rawLimit) ? Math.trunc(rawLimit) : 50),
  );

  const rows = await db.changeLog.findMany({
    where: { action: { not: { startsWith: "personal" } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit * 2, // headroom so a filtered row never shrinks the page
  });

  const visible = rows.filter((r) => !PRIVATE_ACTION_RE.test(r.action)).slice(0, limit);

  return NextResponse.json({
    changes: visible.map((r) => {
      let payload: unknown = {};
      try {
        payload = JSON.parse(r.payload);
      } catch {
        payload = r.payload;
      }
      return {
        id: r.id,
        actorId: r.actorId,
        actorName: r.actorName,
        action: r.action,
        payload,
        createdAt: r.createdAt.toISOString(),
      };
    }),
  });
}
