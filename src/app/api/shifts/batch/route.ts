import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError, minToHHMM, requireTrainer } from "@/lib/auth";
import { broadcast } from "@/lib/emit";
import {
  findOverlap,
  inWindow,
  isDateStr,
  logChange,
  shiftShape,
  trainerBriefSelect,
} from "../../_helpers";

export const dynamic = "force-dynamic";

const opSchema = z.object({
  id: z.string().min(1),
  /** optional new day — a cross-day drag moves the whole shift there */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startMin: z.number().int().min(0).max(1440),
  endMin: z.number().int().min(0).max(1440),
});

const bodySchema = z.object({ ops: z.array(opSchema).min(1).max(5) });

/**
 * POST /api/shifts/batch {ops:[{id, date?, startMin, endMin}]} (auth)
 * -> {shifts:[...]} | 400 window/bad_request | 404 | 409 overlap
 *
 * Atomic multi-update behind calendar drag & drop: a dragged shift plus its
 * optional swap neighbour must land together (half a swap would corrupt the
 * schedule). All ops are validated against the FINAL state — batch members
 * may "collide" with each other mid-swap (they move simultaneously), so they
 * are excluded from each other's overlap checks. Applied in one transaction.
 */
export async function POST(req: NextRequest) {
  const actor = await requireTrainer(req);
  if (!actor) return jsonError("unauthorized", 401);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("bad_request", 400);
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return jsonError("bad_request", 400);

  const ops = parsed.data.ops;
  const ids = [...new Set(ops.map((o) => o.id))];
  if (ids.length !== ops.length) return jsonError("bad_request", 400);

  const existing = await db.shift.findMany({
    where: { id: { in: ids } },
    include: { trainer: trainerBriefSelect },
  });
  if (existing.length !== ids.length) return jsonError("not_found", 404);
  const byId = new Map(existing.map((s) => [s.id, s]));

  /** final state of every op (missing fields fall back to the current values) */
  const finals = ops.map((op) => {
    const cur = byId.get(op.id)!;
    return { op, cur, date: op.date ?? cur.date, startMin: op.startMin, endMin: op.endMin };
  });

  for (const f of finals) {
    if (!isDateStr(f.date) || f.endMin <= f.startMin) return jsonError("bad_request", 400);
    if (!inWindow(f.date, f.startMin, f.endMin)) return jsonError("window", 400);
  }

  // overlap vs shifts OUTSIDE the batch (batch members move together)
  for (const f of finals) {
    const overlap = await findOverlap(f.cur.trainerId, f.date, f.startMin, f.endMin, ids);
    if (overlap) return jsonError("overlap", 409);
  }

  const updated = await db.$transaction(
    finals.map((f) =>
      db.shift.update({
        where: { id: f.op.id },
        data: {
          ...(f.date !== f.cur.date ? { date: f.date } : {}),
          startMin: f.startMin,
          endMin: f.endMin,
        },
        include: { trainer: trainerBriefSelect },
      }),
    ),
  );

  // one feed entry per moved shift (a swap = two entries)
  for (const f of finals) {
    const payload: Record<string, unknown> = {
      date: f.date,
      trainerName: f.cur.trainer.name,
      start: minToHHMM(f.startMin),
      end: minToHHMM(f.endMin),
      oldStart: minToHHMM(f.cur.startMin),
      oldEnd: minToHHMM(f.cur.endMin),
    };
    if (f.date !== f.cur.date) payload.oldDate = f.cur.date;
    if (f.cur.note) payload.note = f.cur.note;
    await logChange({ id: actor.id, name: actor.name }, "shift_edit", payload);
  }
  await broadcast("shifts:changed");

  return NextResponse.json({ shifts: updated.map(shiftShape) });
}
