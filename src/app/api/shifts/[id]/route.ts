import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError, minToHHMM, requireTrainer } from "@/lib/auth";
import { broadcast } from "@/lib/emit";
import {
  findOverlap,
  inWindow,
  logChange,
  shiftShape,
  trainerBriefSelect,
} from "../../_helpers";

export const dynamic = "force-dynamic";

// date is immutable — a "date" field in the body is stripped by zod.
const putSchema = z.object({
  trainerId: z.string().min(1).optional(),
  startMin: z.number().int().min(0).max(1440).optional(),
  endMin: z.number().int().min(0).max(1440).optional(),
  note: z.string().nullish(),
});

/**
 * PUT /api/shifts/:id {trainerId?, startMin?, endMin?, note?} (auth)
 * -> {shift} | 400 window/bad_request | 404 | 409 overlap
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await requireTrainer(req);
  if (!actor) return jsonError("unauthorized", 401);

  const { id } = await params;
  const existing = await db.shift.findUnique({ where: { id } });
  if (!existing) return jsonError("not_found", 404);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("bad_request", 400);
  }
  const parsed = putSchema.safeParse(raw);
  if (!parsed.success) return jsonError("bad_request", 400);

  const trainerId = parsed.data.trainerId ?? existing.trainerId;
  const startMin = parsed.data.startMin ?? existing.startMin;
  const endMin = parsed.data.endMin ?? existing.endMin;
  const note =
    parsed.data.note === undefined ? existing.note : (parsed.data.note ?? null);

  const targetTrainer = await db.trainer.findUnique({ where: { id: trainerId } });
  if (!targetTrainer) return jsonError("bad_request", 400);

  if (!inWindow(existing.date, startMin, endMin)) return jsonError("window", 400);

  const overlap = await findOverlap(
    trainerId,
    existing.date,
    startMin,
    endMin,
    existing.id,
  );
  if (overlap) return jsonError("overlap", 409);

  const shift = await db.shift.update({
    where: { id: existing.id },
    data: { trainerId, startMin, endMin, note },
    include: { trainer: trainerBriefSelect },
  });

  const payload: Record<string, unknown> = {
    date: existing.date,
    trainerName: targetTrainer.name,
    start: minToHHMM(startMin),
    end: minToHHMM(endMin),
    oldStart: minToHHMM(existing.startMin),
    oldEnd: minToHHMM(existing.endMin),
  };
  if (note) payload.note = note;
  await logChange({ id: actor.id, name: actor.name }, "shift_edit", payload);
  await broadcast("shifts:changed");

  return NextResponse.json({ shift: shiftShape(shift) });
}

/** DELETE /api/shifts/:id (auth) -> {ok:true} | 404 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await requireTrainer(req);
  if (!actor) return jsonError("unauthorized", 401);

  const { id } = await params;
  const existing = await db.shift.findUnique({
    where: { id },
    include: { trainer: trainerBriefSelect },
  });
  if (!existing) return jsonError("not_found", 404);

  await db.shift.delete({ where: { id } });

  const payload: Record<string, unknown> = {
    date: existing.date,
    trainerName: existing.trainer.name,
    start: minToHHMM(existing.startMin),
    end: minToHHMM(existing.endMin),
  };
  if (existing.note) payload.note = existing.note;
  await logChange({ id: actor.id, name: actor.name }, "shift_delete", payload);
  await broadcast("shifts:changed");

  return NextResponse.json({ ok: true });
}
