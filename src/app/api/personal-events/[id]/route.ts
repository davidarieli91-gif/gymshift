import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError, requireTrainer } from "@/lib/auth";
import {
  REPEAT_KINDS,
  isDateStr,
  personalEventShape,
} from "../../_helpers";

export const dynamic = "force-dynamic";

// date is editable — an event can be moved to another day
const putSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  title: z.string().trim().min(1).max(80).optional(),
  startMin: z.number().int().min(0).max(1440).optional(),
  endMin: z.number().int().min(0).max(1440).optional(),
  allDay: z.boolean().optional(),
  note: z.string().nullish(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullish(),
  repeat: z.enum(REPEAT_KINDS).optional(),
});

function addException(exceptions: string | null, occ: string): string {
  const set = new Set((exceptions ?? "").split(",").filter(Boolean));
  set.add(occ);
  return [...set].sort().join(",");
}

/**
 * PUT /api/personal-events/:id (owner only) -> {event} | 404
 * 404 (not 403) even for another trainer's event — never reveal existence.
 * Private: no ChangeLog entry, no realtime broadcast.
 *
 * Recurring series (repeat != "none") accept scope semantics, like Google:
 * - ?occ=yyyy-mm-dd                 (or scope=series) → edit the WHOLE series;
 *   changing `date` re-anchors the series origin.
 * - ?occ=yyyy-mm-dd&scope=this      → this occurrence only: the original date
 *   is added to `exceptions` and a standalone (repeat="none") event is created
 *   with the new values — Google's "This event" behaviour for moves.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await requireTrainer(req);
  if (!actor) return jsonError("unauthorized", 401);

  const { id } = await params;
  const existing = await db.personalEvent.findUnique({ where: { id } });
  if (!existing || existing.trainerId !== actor.id) return jsonError("not_found", 404);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("bad_request", 400);
  }
  const parsed = putSchema.safeParse(raw);
  if (!parsed.success) return jsonError("bad_request", 400);

  const q = req.nextUrl.searchParams;
  const occ = q.get("occ");
  const scope = q.get("scope") === "this" ? "this" : "series";
  if (occ !== null && !isDateStr(occ)) return jsonError("bad_request", 400);

  /* single (non-repeating) event — plain update, `occ` is meaningless */
  if (existing.repeat === "none") {
    const date = parsed.data.date ?? existing.date;
    if (!isDateStr(date)) return jsonError("bad_request", 400);

    const allDay = parsed.data.allDay ?? existing.allDay;
    const startMin = allDay ? 0 : (parsed.data.startMin ?? existing.startMin);
    const endMin = allDay ? 1440 : (parsed.data.endMin ?? existing.endMin);
    if (!allDay && startMin >= endMin) return jsonError("bad_request", 400);

    const title = parsed.data.title?.trim() || existing.title;
    const note =
      parsed.data.note === undefined ? existing.note : (parsed.data.note?.trim() || null);
    const color =
      parsed.data.color === undefined ? existing.color : (parsed.data.color ?? null);
    const repeat = parsed.data.repeat ?? existing.repeat;

    const event = await db.personalEvent.update({
      where: { id: existing.id },
      data: { date, title, startMin, endMin, allDay, note, color, repeat },
    });
    return NextResponse.json({ event: personalEventShape(event) });
  }

  /* recurring series */
  if (!occ) return jsonError("bad_request", 400); // occurrences must carry their date

  if (scope === "series") {
    // apply to the whole series; `date` re-anchors the origin when provided
    const date = parsed.data.date ?? existing.date;
    if (!isDateStr(date)) return jsonError("bad_request", 400);

    const allDay = parsed.data.allDay ?? existing.allDay;
    const startMin = allDay ? 0 : (parsed.data.startMin ?? existing.startMin);
    const endMin = allDay ? 1440 : (parsed.data.endMin ?? existing.endMin);
    if (!allDay && startMin >= endMin) return jsonError("bad_request", 400);

    const title = parsed.data.title?.trim() || existing.title;
    const note =
      parsed.data.note === undefined ? existing.note : (parsed.data.note?.trim() || null);
    const color =
      parsed.data.color === undefined ? existing.color : (parsed.data.color ?? null);
    const repeat = parsed.data.repeat ?? existing.repeat;

    const event = await db.personalEvent.update({
      where: { id: existing.id },
      data: { date, title, startMin, endMin, allDay, note, color, repeat },
    });
    return NextResponse.json({ event: personalEventShape(event) });
  }

  /* scope=this — detach this occurrence: exception + standalone event */
  const date = parsed.data.date ?? occ;
  if (!isDateStr(date)) return jsonError("bad_request", 400);

  const allDay = parsed.data.allDay ?? existing.allDay;
  const startMin = allDay ? 0 : (parsed.data.startMin ?? existing.startMin);
  const endMin = allDay ? 1440 : (parsed.data.endMin ?? existing.endMin);
  if (!allDay && startMin >= endMin) return jsonError("bad_request", 400);

  const title = parsed.data.title?.trim() || existing.title;
  const note =
    parsed.data.note === undefined ? existing.note : (parsed.data.note?.trim() || null);
  const color = parsed.data.color === undefined ? existing.color : (parsed.data.color ?? null);

  const [, updated] = await db.$transaction([
    db.personalEvent.update({
      where: { id: existing.id },
      data: { exceptions: addException(existing.exceptions, occ) },
    }),
    db.personalEvent.create({
      data: {
        trainerId: actor.id,
        date,
        title,
        startMin,
        endMin,
        allDay,
        note,
        color,
        repeat: "none",
      },
    }),
  ]);

  return NextResponse.json({ event: personalEventShape(updated), moved: true });
}

/**
 * DELETE /api/personal-events/:id (owner only) -> {ok:true} | 404
 * - plain, or ?scope=series → the whole series (and single events) is removed;
 * - ?occ=yyyy-mm-dd&scope=this → only that occurrence disappears (exception).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await requireTrainer(req);
  if (!actor) return jsonError("unauthorized", 401);

  const { id } = await params;
  const existing = await db.personalEvent.findUnique({ where: { id } });
  if (!existing || existing.trainerId !== actor.id) return jsonError("not_found", 404);

  const q = req.nextUrl.searchParams;
  const occ = q.get("occ");
  const scope = q.get("scope") === "this" ? "this" : "series";
  if (occ !== null && !isDateStr(occ)) return jsonError("bad_request", 400);

  if (existing.repeat !== "none" && occ && scope === "this") {
    await db.personalEvent.update({
      where: { id: existing.id },
      data: { exceptions: addException(existing.exceptions, occ) },
    });
    return NextResponse.json({ ok: true });
  }

  await db.personalEvent.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
