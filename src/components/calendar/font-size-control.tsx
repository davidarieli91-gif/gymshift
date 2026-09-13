"use client";

import { useState } from "react";
import { ALargeSmall, Minus, Plus, RotateCcw } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import type { Dict } from "@/lib/i18n";

interface FontSizeControlProps {
  /** current root font scale: 0.8 .. 1.4 (1 = default) */
  scale: number;
  /** +1 → larger, -1 → smaller (one step = 10 %) */
  onStep: (dir: 1 | -1) => void;
  onReset: () => void;
  t: Dict;
}

const MIN = 0.8;
const MAX = 1.4;

/**
 * System-wide font size buttons «− / +» (scales the root font size, so the
 * whole UI grows or shrinks — rem text and spacing alike).
 * Desktop: a compact inline [− 100 % +] group in the header.
 * Smartphones: a single «Aa» trigger that opens the same controls enlarged
 * to comfortable touch size, plus a reset button.
 */
export function FontSizeControl({ scale, onStep, onReset, t }: FontSizeControlProps) {
  const [open, setOpen] = useState(false);
  const pct = Math.round(scale * 100);

  const dec = (
    <button
      type="button"
      aria-label={t.fontSize.dec}
      disabled={scale <= MIN}
      onClick={() => onStep(-1)}
      className="flex items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent disabled:opacity-35"
    >
      <Minus className="size-4" aria-hidden="true" />
    </button>
  );
  const inc = (
    <button
      type="button"
      aria-label={t.fontSize.inc}
      disabled={scale >= MAX}
      onClick={() => onStep(1)}
      className="flex items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent disabled:opacity-35"
    >
      <Plus className="size-4" aria-hidden="true" />
    </button>
  );
  const value = (
    <span
      dir="ltr"
      aria-live="polite"
      className="select-none text-center text-[0.6875rem] font-semibold tabular-nums text-muted-foreground"
    >
      {pct}%
    </span>
  );

  return (
    <>
      {/* desktop: one-tap inline stepper */}
      <div
        role="group"
        aria-label={t.fontSize.label}
        className="hidden h-9 items-center gap-0.5 rounded-lg border border-border bg-card px-1 sm:flex"
      >
        {dec}
        <span className="w-10">{value}</span>
        {inc}
      </div>

      {/* smartphone: same controls inside a popover, sized for touch */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="size-9 shrink-0 rounded-lg sm:hidden"
            aria-label={`${t.fontSize.label} · ${pct}%`}
          >
            <ALargeSmall className="size-4" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-3">
          <p className="mb-2 text-xs font-semibold text-foreground">{t.fontSize.label}</p>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label={t.fontSize.dec}
              disabled={scale <= MIN}
              onClick={() => onStep(-1)}
              className="flex h-11 w-14 items-center justify-center rounded-xl border border-border bg-card transition-colors hover:bg-accent disabled:opacity-35"
            >
              <Minus className="size-5" aria-hidden="true" />
            </button>
            <span dir="ltr" aria-live="polite" className="text-base font-bold tabular-nums">
              {pct}%
            </span>
            <button
              type="button"
              aria-label={t.fontSize.inc}
              disabled={scale >= MAX}
              onClick={() => onStep(1)}
              className="flex h-11 w-14 items-center justify-center rounded-xl border border-border bg-card transition-colors hover:bg-accent disabled:opacity-35"
            >
              <Plus className="size-5" aria-hidden="true" />
            </button>
          </div>
          {scale !== 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-9 w-full gap-1.5 text-xs text-muted-foreground"
              onClick={onReset}
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              {t.fontSize.reset}
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </>
  );
}
