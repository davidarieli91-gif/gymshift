"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Lock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ViewSwitcher } from "./view-switcher";
import type { Dict } from "@/lib/i18n";
import type { CalendarMode, ViewId } from "@/lib/types";

interface CalendarToolbarProps {
  view: ViewId;
  title: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (v: ViewId) => void;
  /** add a shared team shift (or, in personal mode, a private event) */
  onAdd: () => void;
  /** switch between the shared shifts calendar and the private one */
  mode: CalendarMode;
  onToggleMode: () => void;
  t: Dict;
}

/** Period navigation + title + view switcher + «add» + «личный календарь» toggle */
export function CalendarToolbar({
  view,
  title,
  onPrev,
  onNext,
  onToday,
  onViewChange,
  onAdd,
  mode,
  onToggleMode,
  t,
}: CalendarToolbarProps) {
  const personal = mode === "personal";
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="size-8 rounded-lg"
          onClick={onPrev}
          aria-label="previous period"
        >
          <ChevronLeft className="size-4 rtl:rotate-180" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8 rounded-lg"
          onClick={onNext}
          aria-label="next period"
        >
          <ChevronRight className="size-4 rtl:rotate-180" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8 rounded-lg px-2.5 text-xs" onClick={onToday}>
          {t.today}
        </Button>
      </div>

      <ViewSwitcher view={view} onChange={onViewChange} t={t} />

      <div className="flex items-center gap-2">
        {personal ? (
          /* private event — dashed outline signals privacy */
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 rounded-lg border-dashed px-3"
            style={{ borderColor: "color-mix(in srgb, var(--primary) 45%, transparent)" }}
            onClick={onAdd}
            aria-label={t.personal.add}
          >
            <Plus className="size-4 text-primary" aria-hidden="true" />
            <span className="hidden min-[420px]:inline">{t.personal.add}</span>
          </Button>
        ) : (
          <Button size="sm" className="h-9 gap-1.5 rounded-lg px-3" onClick={onAdd}>
            <Plus className="size-4" />
            <span className="hidden sm:inline">{t.addShift}</span>
          </Button>
        )}

        {/* «Личный календарь» toggle: pressed = you are inside your private calendar,
            the label then offers the way back to the shared one */}
        <Button
          variant="outline"
          size="sm"
          aria-pressed={personal}
          className="h-9 gap-1.5 rounded-lg border-dashed px-2.5 sm:px-3"
          style={
            personal
              ? {
                  borderColor: "color-mix(in srgb, var(--primary) 60%, transparent)",
                  background: "color-mix(in srgb, var(--primary) 10%, transparent)",
                  color: "var(--primary)",
                }
              : { borderColor: "color-mix(in srgb, var(--primary) 40%, transparent)" }
          }
          onClick={onToggleMode}
          aria-label={personal ? t.personal.team : t.personal.calendar}
          title={personal ? t.personal.team : t.personal.calendar}
        >
          {personal ? (
            <CalendarDays className="size-4" aria-hidden="true" />
          ) : (
            <Lock className="size-4" style={{ color: "var(--primary)" }} aria-hidden="true" />
          )}
          <span className="hidden min-[420px]:inline">
            {personal ? t.personal.team : t.personal.calendar}
          </span>
          <span className="inline min-[420px]:hidden">
            {personal ? t.personal.teamShort : t.personal.calendarShort}
          </span>
        </Button>
      </div>

      {/* on smartphones the title takes its own full-width row below the controls */}
      <h1 className="order-last w-full truncate text-sm font-semibold tracking-tight sm:order-none sm:w-auto sm:min-w-0 sm:flex-1 sm:text-lg">
        {personal && (
          <span
            className="me-1.5 inline-flex translate-y-[-1px] items-center gap-1 rounded-md border border-dashed px-1.5 py-0.5 align-middle text-[0.6875rem] font-semibold"
            style={{
              color: "var(--primary)",
              borderColor: "color-mix(in srgb, var(--primary) 40%, transparent)",
              background: "color-mix(in srgb, var(--primary) 7%, transparent)",
            }}
          >
            <Lock className="size-3 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">{t.personal.calendar}</span>
            <span className="sm:hidden">{t.personal.calendarShort}</span>
          </span>
        )}
        {title}
      </h1>
    </div>
  );
}
