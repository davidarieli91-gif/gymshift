// Core domain types for GymShift — online shift calendar for gym trainers.
// These mirror the REST contract in SPEC.md (backend defines its own copies).

export type Lang = "ru" | "he";

export type ViewId = "day" | "3d" | "week" | "month";

/**
 * Which calendar is on screen:
 * - "team"     — shared shifts of all trainers (default);
 * - "personal" — the logged-in trainer's PRIVATE calendar (only their own
 *                events, same views/grid, dashed-primary visual language).
 */
export type CalendarMode = "team" | "personal";

/** Account role: the first registered account (when no admin exists) becomes admin */
export type Role = "admin" | "trainer";

export interface Trainer {
  id: string;
  name: string;
  /** optional phone, digits-only — used for WhatsApp deep links */
  phone?: string | null;
  color: string;
  role: Role;
  /** cascade counts for the delete confirmation (GET /api/trainers) */
  shiftsCount?: number;
  templateCount?: number;
  /** personal-calendar events count — admins only (delete warning) */
  personalCount?: number;
}

/** Trainer info embedded in shift/template payloads (no phone/role) */
export interface TrainerBrief {
  id: string;
  name: string;
  color: string;
}

export interface Shift {
  id: string;
  /** local date key, format yyyy-mm-dd */
  date: string;
  trainerId: string;
  /** minutes from midnight */
  startMin: number;
  /** minutes from midnight */
  endMin: number;
  note?: string | null;
  trainer?: TrainerBrief;
}

/** Simple recurrence for private events (Google-style subset) */
export type RepeatKind = "none" | "daily" | "weekly" | "monthly";

/**
 * Separator between a series id and the occurrence date inside a composite id
 * (cuid never contains "~", so it is collision-safe).
 */
export const OCC_SEP = "~";

/**
 * PRIVATE calendar event («личный календарь»). Always belongs to the
 * authenticated trainer — the API never returns anyone else's events.
 * Not bound to gym working windows; allDay spans 0:00–24:00.
 * Recurring series arrive EXPANDED: each instance carries a composite
 * id `seriesId~date` and `isOccurrence: true`.
 */
export interface PersonalEvent {
  /** plain id, or composite `seriesId~date` for an expanded occurrence */
  id: string;
  /** local date key, format yyyy-mm-dd */
  date: string;
  title: string;
  /** minutes from midnight (0..1440, ignored when allDay) */
  startMin: number;
  endMin: number;
  allDay: boolean;
  note?: string | null;
  /** Google-like color (hex); null/undefined = theme primary */
  color?: string | null;
  /** repeat rule of the underlying series */
  repeat?: RepeatKind;
  /** true → expanded instance of a repeating series (id is composite) */
  isOccurrence?: boolean;
}

/** Create/update payload for a private event (frontend ↔ API contract) */
export interface PersonalEventDraft {
  date: string;
  title: string;
  startMin: number;
  endMin: number;
  allDay: boolean;
  note?: string | null;
  color?: string | null;
  repeat?: RepeatKind;
}

export type ChangeAction =
  | "shift_add"
  | "shift_edit"
  | "shift_delete"
  | "template_save"
  | "template_apply"
  | "trainer_join"
  | "trainer_add"
  | "trainer_remove";

/**
 * ChangeLog payload (parsed from the JSON string by the API).
 * Fields depend on `action`:
 * - shift_add / shift_edit / shift_delete: {date, trainerName, start, end, oldStart?, oldEnd?, note?}
 * - template_save: {count} · template_apply: {from, to, count}
 * - trainer_join: {} · trainer_add / trainer_remove: {trainerName}
 */
export interface ChangePayload {
  date?: string;
  trainerName?: string;
  start?: string;
  end?: string;
  oldStart?: string;
  oldEnd?: string;
  note?: string;
  count?: number;
  from?: string;
  to?: string;
}

export interface ChangeEntry {
  id: string;
  actorId: string;
  actorName: string;
  action: ChangeAction;
  payload: ChangePayload;
  /** ISO timestamp */
  createdAt: string;
}

/** Weekly template slot: weekday 0=Sun .. 6=Sat, minutes from midnight */
export interface TemplateSlot {
  id: string;
  weekday: number;
  trainerId: string;
  startMin: number;
  endMin: number;
  trainer?: { name: string; color: string };
}

/** Body used to replace the whole template (PUT /api/template) */
export interface TemplateSlotInput {
  weekday: number;
  trainerId: string;
  startMin: number;
  endMin: number;
}
