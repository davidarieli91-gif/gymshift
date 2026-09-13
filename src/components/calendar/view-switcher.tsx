"use client";

import { Calendar, CalendarCheck, CalendarDays, CalendarRange } from "lucide-react";
import type { Dict } from "@/lib/i18n";
import type { ViewId } from "@/lib/types";

interface ViewSwitcherProps {
  view: ViewId;
  onChange: (v: ViewId) => void;
  t: Dict;
}

const ITEMS: { id: ViewId; icon: typeof Calendar }[] = [
  { id: "day", icon: CalendarCheck },
  { id: "3d", icon: CalendarRange },
  { id: "week", icon: CalendarDays },
  { id: "month", icon: Calendar },
];

/** Segmented control: Сегодня / 3 дня / Неделя / Месяц */
export function ViewSwitcher({ view, onChange, t }: ViewSwitcherProps) {
  return (
    <div
      role="tablist"
      aria-label={t.today}
      className="flex items-center gap-0.5 rounded-xl border border-border bg-card p-1"
    >
      {ITEMS.map(({ id, icon: Icon }) => {
        const active = view === id;
        const label = id === "3d" ? t.views.three : t.views[id];
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors ${
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <Icon className="size-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
