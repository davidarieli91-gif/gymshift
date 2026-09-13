/**
 * Shared helpers for the GymShift API route handlers (this file is NOT a route).
 * Response shapes here mirror SPEC.md exactly — the frontend codes against them.
 */
import { DAY_WINDOWS } from "@/lib/constants";
import { db } from "@/lib/db";
import { broadcast } from "@/lib/emit";
import type { Trainer } from "@prisma/client";

/** Trainer object exposed by the API — NEVER includes pinHash. */
export type PublicTrainer = {
  id: string;
  name: string;
  phone: string | null;
  color: string;
  role: string;
};

export function publicTrainer(t: Trainer): PublicTrainer {
  return { id: t.id, name: t.name, phone: t.phone, color: t.color, role: t.role };
}

/** weekday (0=Sun..6=Sat) of a local "yyyy-mm-dd" date. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

/** Strict date check: matches /^\d{4}-\d{2}-\d{2}$/ AND is a real calendar date. */
export function isDateStr(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** "yyyy-mm-dd" + n days -> "yyyy-mm-dd" (local calendar arithmetic). */
export function dateAddDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

/**
 * True when [startMin, endMin] is a valid slot for the given weekday:
 * start < end and both inside DAY_WINDOWS[weekday].
 */
export function inWindowWeekday(
  weekday: number,
  startMin: number,
  endMin: number,
): boolean {
  const win = DAY_WINDOWS[weekday];
  if (!win) return false;
  return startMin < endMin && startMin >= win.start && endMin <= win.end;
}

/** Same as inWindowWeekday but derives the weekday from a "yyyy-mm-dd" date. */
export function inWindow(date: string, startMin: number, endMin: number): boolean {
  return inWindowWeekday(weekdayOf(date), startMin, endMin);
}

/** Normalize a phone to digits only (strip spaces/dashes/parentheses); empty -> null. */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (phone == null) return null;
  const digits = phone.replace(/\D/g, "");
  return digits === "" ? null : digits;
}

/**
 * Append a ChangeLog row and broadcast it as "changes:new"
 * (data = the entry object with a parsed payload, same shape as GET /api/changes).
 */
export async function logChange(
  actor: { id: string; name: string },
  action: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const row = await db.changeLog.create({
    data: {
      actorId: actor.id,
      actorName: actor.name,
      action,
      payload: JSON.stringify(payload),
    },
  });
  await broadcast("changes:new", {
    id: row.id,
    actorId: row.actorId,
    actorName: row.actorName,
    action: row.action,
    payload,
    createdAt: row.createdAt.toISOString(),
  });
}

/** Shift shape returned by the API (includes nested trainer id/name/color). */
export function shiftShape(s: {
  id: string;
  date: string;
  trainerId: string;
  startMin: number;
  endMin: number;
  note: string | null;
  trainer: { id: string; name: string; color: string };
}) {
  return {
    id: s.id,
    date: s.date,
    trainerId: s.trainerId,
    startMin: s.startMin,
    endMin: s.endMin,
    note: s.note,
    trainer: { id: s.trainer.id, name: s.trainer.name, color: s.trainer.color },
  };
}

/** Prisma select for the trainer relation embedded in shifts. */
export const trainerBriefSelect = { select: { id: true, name: true, color: true } } as const;

/** API shape for a personal event (owner always = the authenticated trainer). */
export function personalEventShape(e: {
  id: string;
  date: string;
  title: string;
  startMin: number;
  endMin: number;
  allDay: boolean;
  note: string | null;
  color?: string | null;
  repeat?: string | null;
}) {
  return {
    id: e.id,
    date: e.date,
    title: e.title,
    startMin: e.startMin,
    endMin: e.endMin,
    allDay: e.allDay,
    note: e.note,
    color: e.color ?? null,
    repeat: (e.repeat ?? "none") as "none" | "daily" | "weekly" | "monthly",
  };
}

/* ------------------------------------------------------------------ */
/* Recurrence expansion (private events)                               */
/* ------------------------------------------------------------------ */

export const REPEAT_KINDS = ["none", "daily", "weekly", "monthly"] as const;
export type RepeatKind = (typeof REPEAT_KINDS)[number];

/** "yyyy-mm-dd" -> local Date (noon-free midnight arithmetic). */
function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toDateKey(dt: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

/** Does the occurrence on `key` follow the series that starts on `origin`? */
function matchesRepeat(origin: string, key: string, repeat: RepeatKind): boolean {
  if (key < origin) return false;
  if (repeat === "daily") return true;
  if (repeat === "weekly") return parseDateKey(origin).getDay() === parseDateKey(key).getDay();
  if (repeat === "monthly") return parseDateKey(origin).getDate() === parseDateKey(key).getDate();
  return false;
}

/**
 * Expand a recurring PersonalEvent into concrete occurrences within
 * [from, to]. The series origin row itself is never returned — only expanded
 * instances with composite ids `id~date` (cuid never contains "~").
 * Single occurrences listed in `exceptions` are skipped.
 */
export function expandPersonalEvent(
  e: {
    id: string;
    date: string;
    title: string;
    startMin: number;
    endMin: number;
    allDay: boolean;
    note: string | null;
    color?: string | null;
    repeat?: string | null;
    exceptions?: string | null;
  },
  from: string,
  to: string,
): Array<ReturnType<typeof personalEventShape> & { isOccurrence: boolean }> {
  const base = personalEventShape(e);
  const repeat = (e.repeat ?? "none") as RepeatKind;
  if (repeat === "none") {
    return e.date >= from && e.date <= to ? [{ ...base, isOccurrence: false }] : [];
  }

  const skipped = new Set((e.exceptions ?? "").split(",").filter(Boolean));
  const out: Array<ReturnType<typeof personalEventShape> & { isOccurrence: boolean }> = [];
  // walk day by day over the requested window (bounded: month view = 42 days)
  const start = e.date > from ? e.date : from;
  const cursor = parseDateKey(start);
  const end = parseDateKey(to);
  for (const dt = cursor; dt <= end; dt.setDate(dt.getDate() + 1)) {
    const key = toDateKey(dt);
    if (key < e.date || skipped.has(key)) continue;
    if (!matchesRepeat(e.date, key, repeat)) continue;
    out.push({ ...base, id: `${e.id}~${key}`, date: key, isOccurrence: true });
  }
  return out;
}

/**
 * Overlap test per SPEC: same trainer+date where
 * existing.startMin < newEnd && existing.endMin > newStart (exclude self on update).
 * `excludeId` may be an array — the batch endpoint excludes ALL batch members
 * (they move simultaneously, so mid-swap "collisions" between them are legal).
 */
export function findOverlap(
  trainerId: string,
  date: string,
  startMin: number,
  endMin: number,
  excludeId?: string | string[],
) {
  return db.shift.findFirst({
    where: {
      trainerId,
      date,
      startMin: { lt: endMin },
      endMin: { gt: startMin },
      ...(excludeId
        ? { id: { notIn: Array.isArray(excludeId) ? excludeId : [excludeId] } }
        : {}),
    },
  });
}
