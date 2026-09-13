"use client";

import { useMemo, type ReactNode } from "react";
import { CalendarPlus, Lock, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dateKey, fmtWeekdayShort, minToHHMM, startOfMonth } from "@/lib/format";
import type { Dict } from "@/lib/i18n";
import type { CalendarMode, Lang, PersonalEvent, Shift, Trainer } from "@/lib/types";

interface MonthGridProps {
  cells: Date[];
  shifts: Shift[];
  /** the logged-in trainer's PRIVATE events (nobody else's ever arrive) */
  personalEvents?: PersonalEvent[];
  /** "team" → shared shifts (+ private chips); "personal" → only private events */
  mode?: CalendarMode;
  lang: Lang;
  t: Dict;
  trainers: Map<string, Trainer>;
  onEdit: (s: Shift) => void;
  onEditPersonal?: (e: PersonalEvent) => void;
  /** CTA inside the personal-mode empty state */
  onAddPersonal?: () => void;
  /** personal mode: tap an empty spot in a day cell → quick-create for that date */
  onCreateAtPersonal?: (date: string) => void;
  /** «+N ещё» → switch to the day view of that date */
  onOpenDay: (d: Date) => void;
}

const MAX_CHIPS = 3;
const MAX_PERSONAL = 2;

/** start–end label for a timed entry, e.g. «7:30–12:00» */
function rangeLabel(startMin: number, endMin: number): string {
  return `${minToHHMM(startMin)}–${minToHHMM(endMin)}`;
}

/** Shared chip layout: title line + full time range (stacked under lg, inline from lg) */
function ChipLines({
  title,
  time,
  muted,
  icon,
}: {
  title: string;
  time: string | null;
  muted?: boolean;
  /** optional trailing badge (e.g. repeat marker on recurring private events) */
  icon?: ReactNode;
}) {
  return (
    <span className="flex min-w-0 flex-1 flex-col items-start lg:flex-row lg:items-center lg:gap-1.5">
      <span className="flex min-w-0 max-w-full items-center gap-1">
        <span
          className={`min-w-0 max-w-full truncate text-[0.6875rem] font-medium leading-tight ${
            muted ? "text-muted-foreground" : ""
          }`}
        >
          {title}
        </span>
        {icon}
      </span>
      {time && (
        <span
          dir="ltr"
          className="shrink-0 text-[0.6875rem] font-semibold leading-tight tabular-nums text-muted-foreground"
        >
          {time}
        </span>
      )}
    </span>
  );
}

/**
 * Month view: 7-column grid starting on Sunday, chips per day, weekend tint.
 * Chips always show the FULL time range («7:30–12:00», slightly larger digits).
 * Personal mode turns the whole grid into the trainer's private calendar.
 */
export function MonthGrid({
  cells,
  shifts,
  personalEvents = [],
  mode = "team",
  lang,
  t,
  trainers,
  onEdit,
  onEditPersonal,
  onAddPersonal,
  onCreateAtPersonal,
  onOpenDay,
}: MonthGridProps) {
  const now = new Date();
  const todayKey = dateKey(now);
  const monthAnchor = startOfMonth(cells[Math.floor(cells.length / 2)] ?? now);
  const personalMode = mode === "personal";

  const weekdayLabels = useMemo(() => {
    const base = new Date(2024, 8, 1); // a known Sunday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return fmtWeekdayShort(d, lang);
    });
  }, [lang]);

  const monthKeys = useMemo(() => new Set(cells.map(dateKey)), [cells]);
  const hasAnyPersonal = useMemo(
    () => personalEvents.some((e) => monthKeys.has(e.date)),
    [personalEvents, monthKeys],
  );

  return (
    <div>
      {personalMode && !hasAnyPersonal && (
        <div
          className="mb-3 flex flex-col items-center gap-2 rounded-2xl border border-dashed p-5 text-center"
          style={{
            borderColor: "color-mix(in srgb, var(--primary) 30%, transparent)",
            background: "color-mix(in srgb, var(--primary) 4%, transparent)",
          }}
        >
          <Lock className="size-5" style={{ color: "var(--primary)" }} aria-hidden="true" />
          <p className="text-sm font-medium">{t.personal.empty}</p>
          <p className="text-xs text-muted-foreground">{t.personal.emptyHint}</p>
          {onAddPersonal && (
            <Button
              size="sm"
              variant="outline"
              className="mt-1 h-9 gap-1.5 rounded-lg border-dashed"
              style={{ borderColor: "color-mix(in srgb, var(--primary) 45%, transparent)" }}
              onClick={onAddPersonal}
            >
              <CalendarPlus className="size-4 text-primary" aria-hidden="true" />
              {t.personal.add}
            </Button>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="grid grid-cols-7 border-b border-border bg-bg-header/60">
          {weekdayLabels.map((l) => (
            <div
              key={l}
              className="py-2 text-center text-[0.6875rem] font-medium text-muted-foreground"
            >
              {l}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d) => {
            const key = dateKey(d);
            const inMonth = d.getMonth() === monthAnchor.getMonth();
            const isToday = key === todayKey;
            const isWeekend = d.getDay() === 5 || d.getDay() === 6; // Fri/Sat — Israeli weekend
            const dayShifts = personalMode
              ? []
              : shifts.filter((s) => s.date === key).sort((a, b) => a.startMin - b.startMin);
            /* PRIVACY: private events render in the personal calendar ONLY —
             * never as chips on the shared team month grid */
            const dayPersonal = personalMode
              ? personalEvents
                  .filter((e) => e.date === key)
                  .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.startMin - b.startMin)
              : [];
            const chipsLimit = personalMode ? MAX_CHIPS : MAX_PERSONAL;
            const personalShown = dayPersonal.slice(0, chipsLimit);
            /* single «+N ещё» per day: shift overflow + private overflow (team),
             * private overflow only (personal mode) */
            const moreCount = personalMode
              ? Math.max(dayPersonal.length - MAX_CHIPS, 0)
              : Math.max(dayShifts.length - MAX_CHIPS, 0) +
                Math.max(dayPersonal.length - chipsLimit, 0);

            return (
              <div
                key={key}
                onClick={(e) => {
                  /* Google month behaviour: tapping a day opens quick create.
                   * Chips / «ещё» are buttons — they handle themselves. */
                  if (!personalMode || !onCreateAtPersonal) return;
                  if ((e.target as HTMLElement).closest("button")) return;
                  onCreateAtPersonal(key);
                }}
                className={`min-h-[84px] border-b border-e border-border p-1.5 sm:min-h-[108px] ${
                  inMonth ? "" : "opacity-40"
                } ${isWeekend && inMonth ? "bg-secondary/50" : ""} ${
                  personalMode && onCreateAtPersonal ? "cursor-pointer" : ""
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={`flex size-6 items-center justify-center rounded-full text-xs font-semibold ${
                      isToday ? "bg-primary text-primary-foreground" : ""
                    }`}
                  >
                    {d.getDate()}
                  </span>
                  {!personalMode && dayShifts.length > 0 && (
                    <span
                      className="text-[0.625rem] tabular-nums text-muted-foreground"
                      dir="ltr"
                    >
                      {dayShifts.length}
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  {dayShifts.slice(0, MAX_CHIPS).map((s) => {
                    const name = s.trainer?.name ?? trainers.get(s.trainerId)?.name ?? "—";
                    const color = s.trainer?.color ?? trainers.get(s.trainerId)?.color;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => onEdit(s)}
                        className="flex min-h-6 w-full items-start gap-1.5 rounded-md px-1.5 py-0.5 text-start transition-colors hover:bg-accent"
                        aria-label={`${name} ${rangeLabel(s.startMin, s.endMin)}`}
                      >
                        <span
                          aria-hidden="true"
                          className="mt-1 size-2 shrink-0 rounded-full"
                          style={{ background: color ?? "var(--muted-foreground)" }}
                        />
                        <ChipLines title={name} time={rangeLabel(s.startMin, s.endMin)} />
                      </button>
                    );
                  })}
                  {/* private events — colored dashed chips (event's own Google-like
                      color), personal mode only */}
                  {personalMode &&
                    onEditPersonal &&
                    personalShown.map((e) => {
                      const c = e.color ?? "var(--primary)";
                      const recurring = !!e.repeat && e.repeat !== "none";
                      return (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => onEditPersonal(e)}
                          className="flex min-h-6 w-full items-start gap-1 rounded-md border border-dashed px-1.5 py-0.5 text-start transition-colors"
                          style={{
                            background: `color-mix(in srgb, ${c} 9%, transparent)`,
                            borderColor: `color-mix(in srgb, ${c} 45%, transparent)`,
                          }}
                          aria-label={e.allDay ? e.title : `${e.title} ${rangeLabel(e.startMin, e.endMin)}`}
                        >
                          <Lock
                            className="mt-1 size-2.5 shrink-0"
                            style={{ color: c }}
                            aria-hidden="true"
                          />
                          <ChipLines
                            title={e.title}
                            time={e.allDay ? null : rangeLabel(e.startMin, e.endMin)}
                            icon={recurring ? <Repeat className="size-2.5 shrink-0 opacity-70" style={{ color: c }} aria-hidden="true" /> : undefined}
                          />
                        </button>
                      );
                    })}
                  {moreCount > 0 && (
                    <button
                      type="button"
                      onClick={() => onOpenDay(d)}
                      className="min-h-6 rounded-md px-1.5 text-[0.625rem] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      {t.more(moreCount)}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
