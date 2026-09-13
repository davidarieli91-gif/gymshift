"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { Lock, Repeat, StickyNote } from "lucide-react";
import { minToHHMM } from "@/lib/format";
import type { PersonalEvent } from "@/lib/types";

interface PersonalBlockProps {
  event: PersonalEvent;
  rowH: number;
  /** hour where the grid starts (0 in personal mode — full 24 h) */
  startH: number;
  /** last hour of the grid (exclusive end of the day window) */
  endH: number;
  compact: boolean;
  /** horizontal lane for overlapping timed events (personal mode) */
  lane?: number;
  /** how many lanes share the column width */
  total?: number;
  onEdit: (e: PersonalEvent) => void;
  /** personal mode: start a Google-style move/resize drag (mouse + touch) */
  onBlockPointerDown?: (e: ReactPointerEvent, ev: PersonalEvent, kind: "move" | "resize") => void;
  /** true while a grid drag makes a click on this block meaningless */
  clickSuppressed?: () => boolean;
  /** live drag override — renders the block at the new times (drag ghost) */
  dragOverride?: { startMin: number; endMin: number } | null;
  /** non-interactive cross-day drag image rendered in the target column */
  ghost?: boolean;
}

/** resolve the event's own color (null → theme primary) */
function eventColor(e: PersonalEvent): string {
  return e.color ?? "var(--primary)";
}

/**
 * Private event block («личный календарь») inside a day column.
 * Visually distinct from team shifts: dashed tinted border + lock icon, and —
 * like Google Calendar — painted with the event's own color; recurring events
 * carry a repeat badge. Timed events are clamped to the visible grid.
 * (All-day events render in the full-width band ABOVE the grid, not here.)
 * In personal mode the block body starts a drag-MOVE and its bottom edge a
 * drag-RESIZE — mouse drags immediately, touch after a 300 ms long-press.
 */
export function PersonalBlock({
  event,
  rowH,
  startH,
  endH,
  compact,
  lane = 0,
  total = 1,
  onEdit,
  onBlockPointerDown,
  clickSuppressed,
  dragOverride,
  ghost = false,
}: PersonalBlockProps) {
  const gridStart = startH * 60;
  const gridEnd = endH * 60;
  const gridPx = ((gridEnd - gridStart) / 60) * rowH;

  const effStart = dragOverride?.startMin ?? event.startMin;
  const effEnd = dragOverride?.endMin ?? event.endMin;

  // clamped to the visible window; events fully outside pin to the column edge
  const visStart = Math.max(effStart, gridStart);
  const visEnd = Math.min(effEnd, gridEnd);

  const rawTop = ((visStart - gridStart) / 60) * rowH;
  const top = Math.min(Math.max(rawTop, 0), Math.max(gridPx - 26, 0));
  const height = Math.max(((visEnd - visStart) / 60) * rowH - 3, 22);

  const gapX = compact ? 2 : 5;
  const inset = compact ? 1 : 2;
  /* overlapping timed events share the column through lanes */
  const laneW = 100 / total;
  const width = `calc(${laneW}% - ${gapX}px)`;
  const inlineStart = `calc(${lane * laneW}% + ${inset}px)`;

  const timeLabel = `${minToHHMM(effStart)}–${minToHHMM(effEnd)}`;

  const c = eventColor(event);
  const recurring = !!event.repeat && event.repeat !== "none";
  const dragging = !!dragOverride && !ghost;

  const handlePointerDown = (kind: "move" | "resize") => (e: ReactPointerEvent) => {
    if (onBlockPointerDown) {
      onBlockPointerDown(e, event, kind);
      return;
    }
    /* team mode: a private overlay must never become a seed of anything */
    e.stopPropagation();
  };

  return (
    <button
      type="button"
      /* a drag session (started here in personal mode) must not end in a click */
      onClick={() => {
        if (ghost || clickSuppressed?.()) return;
        onEdit(event);
      }}
      onPointerDown={ghost ? undefined : handlePointerDown("move")}
      aria-hidden={ghost || undefined}
      tabIndex={ghost ? -1 : undefined}
      className={`absolute z-10 flex flex-col items-start justify-start overflow-hidden rounded-lg border border-dashed text-start shadow-sm transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        compact ? "gap-0 px-1 py-0.5" : "gap-0 px-2 py-1"
      } ${
        ghost
          ? "pointer-events-none opacity-95"
          : dragging
            ? "scale-[1.02] cursor-grabbing opacity-90"
            : "cursor-pointer hover:z-20 hover:scale-[1.02]"
      }`}
      style={{
        top,
        height,
        width,
        insetInlineStart: inlineStart,
        zIndex: dragging || ghost ? 40 : undefined,
        background: `color-mix(in srgb, ${c} 10%, transparent)`,
        borderColor: `color-mix(in srgb, ${c} 45%, transparent)`,
        borderInlineStart: `3px dashed color-mix(in srgb, ${c} 80%, transparent)`,
        boxShadow: dragging || ghost ? "0 10px 24px -8px rgba(0,0,0,.35)" : undefined,
      }}
      aria-label={`${event.title} ${timeLabel}`}
      title={event.title}
    >
      {compact ? (
        <span className="flex w-full items-center gap-1">
          <Lock className="size-2.5 shrink-0" style={{ color: c }} aria-hidden="true" />
          <span className="block truncate text-[0.625rem] font-semibold leading-tight">
            {event.title}
          </span>
        </span>
      ) : (
        <>
          <span className="flex w-full items-center gap-1">
            <Lock className="size-3 shrink-0" style={{ color: c }} aria-hidden="true" />
            <span dir="ltr" className="block truncate text-[0.625rem] font-semibold tabular-nums opacity-75">
              {timeLabel}
            </span>
            {recurring && (
              <Repeat
                className="size-3 shrink-0 opacity-70"
                style={{ color: c }}
                aria-label={event.repeat}
              />
            )}
          </span>
          <span className="block w-full truncate text-[0.6875rem] font-bold leading-tight">
            {event.title}
          </span>
          {event.note && height > 46 && (
            <span className="flex items-center gap-1 text-[0.625rem] leading-tight text-muted-foreground">
              <StickyNote className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{event.note}</span>
            </span>
          )}
        </>
      )}
      {/* bottom resize edge — personal mode (Google-style); touch arms via long-press */}
      {onBlockPointerDown && !compact && (
        <span
          role="presentation"
          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
          onPointerDown={(e) => {
            e.stopPropagation();
            handlePointerDown("resize")(e);
          }}
        />
      )}
    </button>
  );
}
