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
} from "../_helpers";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  trainerId: z.string().min(1),
  startMin: z.number().int().min(0).max(1440),
  endMin: z.number().int().min(0).max(1440),
  note: z.string().nullish(),
});

/**
 * GET /api/shifts?from=yyyy-mm-dd&to=yyyy-mm-dd (auth)
 * -> {shifts:[...]} sorted by date, startMin.
 */
export async function GET(req: NextRequest) {
  const actor = await requireTrainer(req);
  if (!actor) return jsonError("unauthorized", 401);

  const q = req.nextUrl.searchParams;
  const from = q.get("from");
  const to = q.get("to");
  if ((from && !isDateStr(from)) || (to && !isDateStr(to))) {
    return jsonError("bad_request", 400);
  }

  const dateFilter: { gte?: string; lte?: string } = {};
  if (from) dateFilter.gte = from;
  if (to) dateFilter.lte = to;

  const shifts = await db.shift.findMany({
    where: Object.keys(dateFilter).length > 0 ? { date: dateFilter } : undefined,
    include: { trainer: trainerBriefSelect },
    orderBy: [{ date: "asc" }, { startMin: "asc" }],
  });

  return NextResponse.json({ shifts: shifts.map(shiftShape) });
}

/**
 * POST /api/shifts {date, trainerId, startMin, endMin, note?} (auth)
 * -> {shift} | 400 window/bad_request | 409 overlap
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
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return jsonError("bad_request", 400);

  const { date, trainerId, startMin, endMin } = parsed.data;
  const note = parsed.data.note ?? null;

  if (!isDateStr(date)) return jsonError("bad_request", 400);

  const targetTrainer = await db.trainer.findUnique({ where: { id: trainerId } });
  if (!targetTrainer) return jsonError("bad_request", 400);

  if (!inWindow(date, startMin, endMin)) return jsonError("window", 400);

  const overlap = await findOverlap(trainerId, date, startMin, endMin);
  if (overlap) return jsonError("overlap", 409);

  const shift = await db.shift.create({
    data: { date, trainerId, startMin, endMin, note, createdById: actor.id },
    include: { trainer: trainerBriefSelect },
  });

  const payload: Record<string, unknown> = {
    date,
    trainerName: targetTrainer.name,
    start: minToHHMM(startMin),
    end: minToHHMM(endMin),
  };
  if (note) payload.note = note;
  await logChange({ id: actor.id, name: actor.name }, "shift_add", payload);
  await broadcast("shifts:changed");

  return NextResponse.json({ shift: shiftShape(shift) });
}
