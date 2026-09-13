import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError, requireTrainer } from "@/lib/auth";
import {
  REPEAT_KINDS,
  expandPersonalEvent,
  isDateStr,
  personalEventShape,
} from "../_helpers";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().trim().min(1).max(80),
  startMin: z.number().int().min(0).max(1440),
  endMin: z.number().int().min(0).max(1440),
  allDay: z.boolean().optional(),
  note: z.string().nullish(),
  // Google-like extras
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullish(),
  repeat: z.enum(REPEAT_KINDS).optional(),
});

/**
 * GET /api/personal-events?from=yyyy-mm-dd&to=yyyy-mm-dd (auth)
 * -> {events:[...]} — ONLY the authenticated trainer's own events.
 * Recurring series are EXPANDED into concrete occurrences within the window
 * (composite ids `id~date`); deleted single occurrences are skipped.
 * Other trainers' events are unreachable by design (owner-only calendar).
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

  if (!from || !to) {
    // no window → raw rows (used for counts/simple lists)
    const events = await db.personalEvent.findMany({
      where: { trainerId: actor.id },
      orderBy: [{ date: "asc" }, { allDay: "desc" }, { startMin: "asc" }],
    });
    return NextResponse.json({ events: events.map(personalEventShape) });
  }

  // repeating series may start before `from`, so fetch everything up to `to`
  // and expand in memory (a trainer's private list is small)
  const rows = await db.personalEvent.findMany({
    where: { trainerId: actor.id, date: { lte: to } },
  });

  const events = rows
    .flatMap((e) => expandPersonalEvent(e, from, to))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        Number(b.allDay) - Number(a.allDay) ||
        a.startMin - b.startMin,
    );

  return NextResponse.json({ events });
}

/**
 * POST /api/personal-events {date, title, startMin, endMin, allDay?, note?, color?, repeat?} (auth)
 * -> {event} — always created for the authenticated trainer.
 * Private: no ChangeLog entry, no realtime broadcast (would leak to the team).
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

  const { date, title } = parsed.data;
  if (!isDateStr(date)) return jsonError("bad_request", 400);

  const allDay = parsed.data.allDay ?? false;
  // all-day spans the whole day; timed events require a real range (any time of day —
  // personal events are NOT limited to the gym's working windows)
  const startMin = allDay ? 0 : parsed.data.startMin;
  const endMin = allDay ? 1440 : parsed.data.endMin;
  if (!allDay && startMin >= endMin) return jsonError("bad_request", 400);

  const note = parsed.data.note?.trim() ? parsed.data.note.trim() : null;
  const color = parsed.data.color ?? null;
  const repeat = parsed.data.repeat ?? "none";

  const event = await db.personalEvent.create({
    data: { trainerId: actor.id, date, title, startMin, endMin, allDay, note, color, repeat },
  });

  return NextResponse.json({ event: personalEventShape(event) });
}
