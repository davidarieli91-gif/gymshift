"use client";

import { useState, type PointerEvent as ReactPointerEvent } from "react";
import { Pencil, StickyNote, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { TrainerAvatar } from "./trainer-avatar";
import { fmtDateShort, firstName, minToHHMM } from "@/lib/format";
import type { Dict } from "@/lib/i18n";
import type { Lang, Shift, Trainer } from "@/lib/types";

interface ShiftBlockProps {
  shift: Shift;
  /** fallback resolved by the grid from the trainers query */
  trainer?: Trainer;
  lang: Lang;
  t: Dict;
  rowH: number;
  /** hour where the grid starts (union window of visible days) */
  startH: number;
  showTrainer: boolean;
  /** smartphone week layout: first name + start time only */
  compact: boolean;
  /** horizontal lane for overlapping shifts */
  lane?: number;
  /** how many lanes share the column width */
  total?: number;
  onEdit: (s: Shift) => void;
  onDelete: (s: Shift) => void;
  /** team mode: start a Google-style move/resize drag (mouse + touch) */
  onBlockPointerDown?: (e: ReactPointerEvent, s: Shift, kind: "move" | "resize") => void;
  /** true while a grid drag makes the click that follows it meaningless */
  clickSuppressed?: () => boolean;
  /** live drag override — renders the block at the new times (drag ghost) */
  dragOverride?: { startMin: number; endMin: number } | null;
  /** non-interactive cross-day drag image rendered in the target column */
  ghost?: boolean;
}

/** Absolute-positioned shift block inside a day column, with details popover.
 *  In team mode the block body starts a drag-MOVE and its bottom edge a
 *  drag-RESIZE — mouse drags immediately, touch after a 300 ms long-press. */
export function ShiftBlock({
  shift,
  trainer,
  lang,
  t,
  rowH,
  startH,
  showTrainer,
  compact,
  onEdit,
  onDelete,
  onBlockPointerDown,
  clickSuppressed,
  dragOverride,
  ghost = false,
  lane = 0,
  total = 1,
}: ShiftBlockProps) {
  const [popOpen, setPopOpen] = useState(false);
  const name = trainer?.name ?? shift.trainer?.name ?? "—";
  const color = trainer?.color ?? shift.trainer?.color ?? "#94a3b8";

  const effStart = dragOverride?.startMin ?? shift.startMin;
  const effEnd = dragOverride?.endMin ?? shift.endMin;
  const startTime = minToHHMM(effStart);
  const endTime = minToHHMM(effEnd);

  const top = ((effStart - startH * 60) / 60) * rowH;
  const height = Math.max(((Math.max(effEnd, effStart + 30) - effStart) / 60) * rowH - 3, 20);
  const gapX = compact ? 2 : 5;
  const width = `calc(${100 / total}% - ${gapX}px)`;
  const left = `calc(${(lane * 100) / total}% + ${compact ? 1 : 2}px)`;

  const dragging = !!dragOverride && !ghost;

  const content = (
    <>
      {compact ? (
        /* smartphone week: name first, then start time — fits a ~50px column */
        <>
          <span
            className="block w-full truncate text-[0.625rem] font-bold leading-tight"
            style={{ color }}
          >
            {firstName(name)}
          </span>
          <span dir="ltr" className="block text-[0.5625rem] font-semibold leading-tight tabular-nums opacity-70">
            {startTime}
          </span>
        </>
      ) : (
        <>
          <span dir="ltr" className="block text-[0.625rem] font-semibold tabular-nums opacity-75">
            {startTime}–{endTime}
          </span>
          <span className="block truncate text-[0.6875rem] font-bold leading-tight" style={{ color }}>
            {name}
          </span>
          {showTrainer && shift.note && height > 46 && (
            <span className="flex items-center gap-1 text-[0.625rem] leading-tight text-muted-foreground">
              <StickyNote className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{shift.note}</span>
            </span>
          )}
        </>
      )}
    </>
  );

  /* cross-day drag image — a plain, non-interactive shadow of the block */
  if (ghost) {
    return (
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute z-40 flex flex-col items-start justify-start overflow-hidden rounded-lg border text-start opacity-95 shadow-[0_10px_24px_-8px_rgba(0,0,0,.35)] ${
          compact ? "gap-0 px-1 py-0.5" : "gap-0 px-2 py-1"
        }`}
        style={{
          top,
          height,
          width,
          insetInlineStart: left,
          background: `${color}1f`,
          borderInlineStart: `3px solid ${color}`,
          borderColor: `${color}45`,
        }}
      >
        {content}
      </div>
    );
  }

  return (
    <Popover
      /* a finished drag must not end in an opened popover */
      open={popOpen}
      onOpenChange={(o) => {
        if (o && clickSuppressed?.()) return;
        setPopOpen(o);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          onPointerDown={(e) => onBlockPointerDown?.(e, shift, "move")}
          className={`absolute z-10 flex flex-col items-start justify-start overflow-hidden rounded-lg border text-start shadow-sm transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            compact ? "gap-0 px-1 py-0.5" : "gap-0 px-2 py-1"
          } ${dragging ? "cursor-grabbing opacity-90" : "hover:z-20 hover:scale-[1.02]"}`}
          style={{
            top,
            height,
            width,
            insetInlineStart: left,
            zIndex: dragging ? 40 : undefined,
            background: `${color}1f`,
            borderInlineStart: `3px solid ${color}`,
            borderColor: `${color}45`,
            boxShadow: dragging ? "0 10px 24px -8px rgba(0,0,0,.35)" : undefined,
          }}
          aria-label={`${name} ${startTime}–${endTime}`}
        >
          {content}
          {/* bottom resize edge — team mode (Google-style); touch arms via long-press */}
          {onBlockPointerDown && !compact && (
            <span
              role="presentation"
              className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
              onPointerDown={(e) => {
                e.stopPropagation();
                onBlockPointerDown(e, shift, "resize");
              }}
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-60 p-3">
        <div className="flex items-center gap-2.5">
          <TrainerAvatar name={name} color={color} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="text-xs text-muted-foreground">{t.subtitle}</p>
          </div>
        </div>
        <div
          dir="ltr"
          className="mt-2 rounded-md bg-secondary px-2.5 py-1.5 text-center text-xs font-medium tabular-nums"
        >
          {startTime}–{endTime} · {fmtDateShort(new Date(`${shift.date}T00:00:00`), lang)}
        </div>
        {shift.note && (
          <p className="mt-2 flex items-start gap-1.5 rounded-md bg-secondary/60 px-2.5 py-1.5 text-xs text-muted-foreground">
            <StickyNote className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {shift.note}
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <Button variant="outline" size="sm" className="h-8 flex-1 gap-1.5" onClick={() => onEdit(shift)}>
            <Pencil className="size-3.5" />
            {t.btn.edit}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="h-8 flex-1 gap-1.5"
            onClick={() => onDelete(shift)}
          >
            <Trash2 className="size-3.5" />
            {t.btn.delete}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
