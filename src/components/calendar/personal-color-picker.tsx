"use client";

import { Check } from "lucide-react";
import { EVENT_COLORS } from "@/lib/constants";
import type { Dict } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

interface EventColorPickerProps {
  /** hex color, or null = "default" (theme primary) */
  value: string | null;
  onChange: (hex: string | null) => void;
  lang: Lang;
  t: Dict;
  /** compact dots for the quick-create popup */
  size?: "sm" | "md";
}

/**
 * Google-Calendar-style event color chooser: a row of round swatches,
 * the first being "default" (theme primary, shown as a ring-only dot).
 */
export function EventColorPicker({ value, onChange, lang, t, size = "md" }: EventColorPickerProps) {
  const dot = size === "sm" ? "size-[18px]" : "size-[22px]";
  const name = (ru: string, he: string) => (lang === "he" ? he : ru);

  return (
    <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label={t.personal.color}>
      <button
        type="button"
        role="radio"
        aria-checked={value == null}
        aria-label={t.personal.colorDefault}
        title={t.personal.colorDefault}
        onClick={() => onChange(null)}
        className={`${dot} flex items-center justify-center rounded-full border-2 border-dashed transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
        style={{
          borderColor: value == null ? "var(--primary)" : "color-mix(in srgb, var(--primary) 45%, transparent)",
          background: value == null ? "color-mix(in srgb, var(--primary) 18%, transparent)" : "transparent",
        }}
      >
        {value == null && <Check className="size-3" style={{ color: "var(--primary)" }} aria-hidden="true" />}
      </button>
      {EVENT_COLORS.map((c) => {
        const active = value?.toLowerCase() === c.hex;
        return (
          <button
            key={c.hex}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={name(c.ru, c.he)}
            title={name(c.ru, c.he)}
            onClick={() => onChange(c.hex)}
            className={`${dot} flex items-center justify-center rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
            style={{ background: c.hex }}
          >
            {active && (
              <span
                className="flex items-center justify-center rounded-full"
                style={{ boxShadow: "0 0 0 2px var(--card), inset 0 0 0 2px transparent" }}
              >
                <Check className="size-3 text-white drop-shadow" aria-hidden="true" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
