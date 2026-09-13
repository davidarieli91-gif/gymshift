import { dict } from "./i18n";
import type { ChangeEntry, Lang } from "./types";

export const pad = (n: number) => String(n).padStart(2, "0");

/** 450 -> "07:30" */
export function minToHHMM(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

/** "07:30" -> 450 */
export function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** "yyyy-mm-dd" -> local Date (no UTC drift) */
export function dateFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "yyyy-mm-dd" -> "12.06" (day.month, timezone-safe) */
export function shortDM(key: string): string {
  const [, m, d] = key.split("-");
  return `${d}.${m}`;
}

/** local date key yyyy-mm-dd (no UTC drift) */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth() + n, 1, 0, 0, 0, 0);
  return x;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** week starts on Sunday (Israel standard) */
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

/** 6*7 cells covering the month, grid starts on Sunday */
export function monthCells(anchor: Date): Date[] {
  const first = startOfMonth(anchor);
  const gridStart = startOfWeek(first);
  const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  const rows = Math.ceil((first.getDay() + daysInMonth) / 7);
  const cells: Date[] = [];
  for (let i = 0; i < rows * 7; i++) cells.push(addDays(gridStart, i));
  return cells;
}

export const localeOf = (l: Lang) => (l === "ru" ? "ru-RU" : "he-IL");

export function fmtMonthYear(d: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(localeOf(lang), { month: "long", year: "numeric" }).format(d);
}

export function fmtDayFull(d: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(localeOf(lang), {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

export function fmtWeekdayShort(d: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(localeOf(lang), { weekday: "short" }).format(d);
}

export function fmtDateShort(d: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(localeOf(lang), { day: "numeric", month: "short" }).format(d);
}

/** "10–12 июня" / "28 июня – 2 июля" */
export function fmtRangeShort(a: Date, b: Date, lang: Lang): string {
  const loc = localeOf(lang);
  const dayMonth = new Intl.DateTimeFormat(loc, { day: "numeric", month: "short" });
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    const dayOnly = new Intl.DateTimeFormat(loc, { day: "numeric" });
    return `${dayOnly.format(a)}–${dayMonth.format(b)}`;
  }
  return `${dayMonth.format(a)} – ${dayMonth.format(b)}`;
}

/** "07:00–14:30" — wrap in dir="ltr" when rendering in RTL context */
export function fmtTimeRange(start: string, end: string): string {
  return `${start}–${end}`;
}

export function relTime(at: number, lang: Lang, justNow: string): string {
  const diffMin = Math.floor((Date.now() - at) / 60000);
  if (diffMin < 1) return justNow;
  const rtf = new Intl.RelativeTimeFormat(localeOf(lang), { numeric: "auto" });
  if (diffMin < 60) return rtf.format(-diffMin, "minute");
  const h = Math.floor(diffMin / 60);
  if (h < 24) return rtf.format(-h, "hour");
  return rtf.format(-Math.floor(h / 24), "day");
}

/** "чт, 12.06" — weekday short + day.month, timezone-safe */
export function fmtDateLabel(key: string, lang: Lang): string {
  const wd = new Intl.DateTimeFormat(localeOf(lang), { weekday: "short" }).format(dateFromKey(key));
  return `${wd}, ${shortDM(key)}`;
}

/** "0501234567" -> "050-123-4567"; otherwise groups digits as-is (display only) */
export function fmtPhone(digits: string): string {
  if (/^0\d{9}$/.test(digits)) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (/^972\d{9}$/.test(digits)) return `+972-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return digits;
}

/** digits -> international form for wa.me / tel: links; null if not usable.
 *  Israeli local numbers (0XX…) get the 972 country code. */
export function intlPhone(digits: string): string | null {
  if (/^0\d{8,9}$/.test(digits)) return `972${digits.slice(1)}`;
  if (/^972\d{8,9}$/.test(digits)) return digits;
  return null;
}

/** "Авива Гольдман" -> "Авива" (first word, for narrow shift blocks) */
export function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}

interface ChangeArgs {
  actor: string;
  date: string;
  time: string;
  oldTime?: string;
  trainerName: string;
  note?: string;
  range: string;
  count: number;
}

/** Human-readable sentence for a ChangeLog entry, fully localized */
export function describeChange(entry: ChangeEntry, lang: Lang): string {
  const t = dict[lang];
  const p = entry.payload ?? {};
  const a: ChangeArgs = {
    actor: entry.actorName,
    date: p.date ? fmtDateLabel(p.date, lang) : "",
    time: p.start && p.end ? `${p.start}–${p.end}` : "",
    oldTime: p.oldStart && p.oldEnd ? `${p.oldStart}–${p.oldEnd}` : undefined,
    trainerName: p.trainerName ?? "",
    note: p.note,
    range: p.from && p.to ? `${shortDM(p.from)}–${shortDM(p.to)}` : "",
    count: p.count ?? 0,
  };
  switch (entry.action) {
    case "shift_add":
      return t.changes.shiftAdd(a);
    case "shift_edit":
      return t.changes.shiftEdit(a);
    case "shift_delete":
      return t.changes.shiftDelete(a);
    case "template_save":
      return t.changes.templateSave(a);
    case "template_apply":
      return t.changes.templateApply(a);
    case "trainer_join":
      return t.changes.trainerJoin(a);
    case "trainer_add":
      return t.changes.trainerAdd(a);
    case "trainer_remove":
      return t.changes.trainerRemove(a);
    default:
      return entry.action;
  }
}

/** WhatsApp-ready message: «🏋️ GymShift: Игорь изменил смену — чт, 12.06 · 15:00–22:30 (Йоси)» */
export function buildChangeMessage(entry: ChangeEntry, lang: Lang): string {
  return `🏋️ GymShift: ${describeChange(entry, lang)}`;
}
