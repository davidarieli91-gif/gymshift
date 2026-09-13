"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarPlus, Lock, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShiftBlock } from "./shift-block";
import { PersonalBlock } from "./personal-block";
import { dateFromKey, dateKey, fmtWeekdayShort, minToHHMM, pad } from "@/lib/format";
import { DAY_WINDOWS } from "@/lib/constants";
import type { Dict } from "@/lib/i18n";
import type { CalendarMode, Lang, PersonalEvent, Shift, Trainer } from "@/lib/types";

/** Seed of a new private event produced by dragging (or clicking) the grid */
export interface GridDragSpec {
  date: string;
  startMin: number;
  endMin: number;
  /** screen point where the pointer was released — anchors the quick-create popup */
  anchor: { x: number; y: number };
}

/** request to move/resize an existing private event (dropped after a drag) */
export interface PersonalMoveSpec {
  event: PersonalEvent;
  /** new day of a cross-day drag — undefined keeps the event's own date */
  date?: string;
  startMin: number;
  endMin: number;
  /** the neighbour the block swapped places with on drop (same-day drags) */
  swapWith?: { event: PersonalEvent; startMin: number; endMin: number } | null;
}

/** request to move/resize an existing shared shift (dropped after a drag) */
export interface ShiftMoveSpec {
  shift: Shift;
  /** new day of a cross-day drag — undefined keeps the shift's own date */
  date?: string;
  startMin: number;
  endMin: number;
  /** the neighbour shift the block swapped slots with on drop (same-day drags) */
  swapWith?: { shift: Shift; startMin: number; endMin: number } | null;
}

interface MultiDayGridProps {
  days: Date[];
  shifts: Shift[];
  /** the logged-in trainer's PRIVATE events (nobody else's ever arrive) */
  personalEvents?: PersonalEvent[];
  /** "team" → shared shifts (+ private overlays); "personal" → only private events */
  mode?: CalendarMode;
  lang: Lang;
  t: Dict;
  trainers: Map<string, Trainer>;
  rowH: number;
  /** true on smartphone-width viewports — enables the compressed layout */
  narrow: boolean;
  onEdit: (s: Shift) => void;
  onDelete: (s: Shift) => void;
  onEditPersonal?: (e: PersonalEvent) => void;
  /** CTA inside the personal-mode empty state */
  onAddPersonal?: () => void;
  /** Google-style drag-to-create — personal mode opens the quick popup,
   *  team mode the shift dialog; called when a range is selected */
  onCreateAt?: (spec: GridDragSpec) => void;
  /** Google-style drag-to-move / resize of an existing private event */
  onMovePersonal?: (spec: PersonalMoveSpec) => void;
  /** Google-style drag-to-move / resize of an existing shared shift (team) */
  onMoveShift?: (spec: ShiftMoveSpec) => void;
}

interface Placed<T> {
  item: T;
  lane: number;
  total: number;
}

/** live selection while rubber-banding a time range */
interface Sel {
  dayIdx: number;
  aMin: number;
  bMin: number;
}

/** the block a move/resize drag is currently carrying: a private event
 *  (personal mode) or a shared shift (team mode) */
type DragItem =
  | { type: "personal"; ev: PersonalEvent }
  | { type: "shift"; shift: Shift };

const itemDate = (it: DragItem): string => (it.type === "personal" ? it.ev.date : it.shift.date);
const itemStart = (it: DragItem): number =>
  it.type === "personal" ? it.ev.startMin : it.shift.startMin;
const itemEnd = (it: DragItem): number =>
  it.type === "personal" ? it.ev.endMin : it.shift.endMin;
const itemId = (it: DragItem): string =>
  it.type === "personal" ? baseId(it.ev.id) : it.shift.id;

/** live move/resize of an existing block (private event or shared shift) */
interface BlockDrag {
  kind: "move" | "resize";
  item: DragItem;
  /** the day the drag started on */
  originDate: string;
  /** current target day of the drag (cross-day drags move it around) */
  dateKey: string;
  startMin: number;
  endMin: number;
  moved: boolean;
  /** same-day neighbour the block will swap places with on drop */
  swap: { item: DragItem; startMin: number; endMin: number } | null;
}

/** imperative drag session: handlers + long-press timer bound to one pointer */
interface DragSession {
  pointerId: number;
  armed: boolean;
  timer: number | undefined;
  cleanup: () => void;
}

/** Greedy lane assignment so overlapping entries sit side by side */
function assignLanes<T extends { startMin: number; endMin: number }>(list: T[]): Placed<T>[] {
  const sorted = [...list].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const laneEnds: number[] = [];
  const placed = sorted.map((item) => {
    const st = item.startMin;
    const en = Math.max(item.endMin, st + 30);
    let lane = laneEnds.findIndex((e) => e <= st);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(en);
    } else {
      laneEnds[lane] = en;
    }
    return { item, lane };
  });
  const total = Math.max(1, laneEnds.length);
  return placed.map((p) => ({ ...p, total }));
}

const SNAP = 15; // minutes — the same snap Google Calendar uses
const LONG_PRESS_MS = 300; // touch: hold still to arm a drag, then move
const TOUCH_SLOP = 10; // px of movement that turns an unarmed touch into a scroll

/** series id without the occurrence suffix (`seriesId~date` → `seriesId`) */
const baseId = (id: string) => id.split("~")[0];

/**
 * Time-grid calendar used for «Сегодня», «3 дня» и «Неделя».
 * Team mode: one column per day, hour range = union of the visible days'
 * working windows (DAY_WINDOWS), labels every 2 h, red "now" line.
 * Drags here manage SHARED SHIFTS: rubber-band on empty space (or a tap)
 * opens the shift dialog prefilled with the range, dragging a block moves
 * it in time / to another day, dropping it onto a neighbour SWAPS their
 * slots (trainers can exchange shifts in one gesture), the bottom edge
 * resizes — everything clamped to the target day's working window.
 *
 * Personal mode («личный календарь») follows Google Calendar:
 * - the grid always spans the FULL day 00:00–24:00;
 * - hour lines every hour (+ faint half-hour lines on desktop);
 * - all-day events live in a dedicated full-width band above the grid;
 * - drag on an empty slot → rubber-band selection (15-min snap) → quick-create;
 * - drag an event block → move it (to another TIME or another DAY — the block
 *   jumps between columns), dropping it onto a neighbour SWAPS their slots;
 * - drag its bottom edge → resize.
 *
 * PRIVACY: private events render in personal mode ONLY — the team calendar
 * never shows them (neither other people's nor the owner's own).
 *
 * Input: unified Pointer Events — the mouse starts drags immediately, touch
 * arms them with a 300 ms long-press. The grid sets `touch-action: none` and
 * the component drives page scrolling itself, so the browser can never steal
 * the gesture (previously a slight finger drift made the browser pan and
 * cancel the drag, leaving taps as the only working input on phones).
 */
export function MultiDayGrid({
  days,
  shifts,
  personalEvents = [],
  mode = "team",
  lang,
  t,
  trainers,
  rowH,
  narrow,
  onEdit,
  onDelete,
  onEditPersonal,
  onAddPersonal,
  onCreateAt,
  onMovePersonal,
  onMoveShift,
}: MultiDayGridProps) {
  const compact = narrow && days.length > 3;
  const personalMode = mode === "personal";
  /* drag-to-create works in BOTH calendars: personal opens the quick popup,
   * team opens the shift dialog prefilled with the dragged range */
  const canDrag = !!onCreateAt;
  const canMove = !!onMovePersonal || !!onMoveShift;

  const dayKeys = useMemo(() => new Set(days.map(dateKey)), [days]);
  const visiblePersonal = useMemo(
    () => personalEvents.filter((e) => dayKeys.has(e.date)),
    [personalEvents, dayKeys],
  );

  /** all-day chips per day — they live in the band above the time grid */
  const allDayByDay = useMemo(
    () => days.map((d) => visiblePersonal.filter((e) => e.date === dateKey(d) && e.allDay)),
    [days, visiblePersonal],
  );
  const allDayTotal = allDayByDay.reduce((n, l) => n + l.length, 0);
  const showAllDayBand = personalMode || allDayTotal > 0;
  const allDayRows = Math.max(1, ...allDayByDay.map((l) => l.length));
  const allDayChipH = compact ? 20 : 24;
  const allDayBandH = allDayRows * (allDayChipH + 3) + 6;

  /** team: union window of the visible days; personal: the FULL 24 h (00–24) */
  const win = useMemo(() => {
    if (personalMode) return { startH: 0, endH: 24 };
    let start = Infinity;
    let end = -Infinity;
    for (const d of days) {
      const w = DAY_WINDOWS[d.getDay()];
      start = Math.min(start, w.start);
      end = Math.max(end, w.end);
    }
    return { startH: Math.floor(start / 60), endH: Math.ceil(end / 60) };
  }, [days, personalMode]);

  /** personal mode labels every hour; team mode every 2 h (as before) */
  const labels = useMemo(() => {
    const out: number[] = [];
    if (personalMode) {
      for (let h = 0; h < 24; h++) out.push(h);
      return out;
    }
    for (let h = win.startH + (win.startH % 2); h <= win.endH; h += 2) out.push(h);
    return out;
  }, [win, personalMode]);

  const gridMin = win.startH * 60;
  const gridMax = win.endH * 60;
  const gridH = (win.endH - win.startH) * rowH;

  const now = new Date();
  const nowKey = dateKey(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const gutter = compact ? "18px" : "52px";
  const cols = `${gutter} repeat(${days.length}, minmax(0, 1fr))`;
  const minGridWidth = compact ? 0 : 52 + days.length * 96;

  /* ---------- shared pointer helpers (create + move/resize) ---------- */
  const gridRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragSession | null>(null);
  const [sel, setSel] = useState<Sel | null>(null);
  const selRef = useRef<Sel | null>(null);
  const [blockDrag, setBlockDrag] = useState<BlockDrag | null>(null);
  const blockDragRef = useRef<BlockDrag | null>(null);
  /** recent drop after a block drag — swallows the click that follows it */
  const suppressClickUntil = useRef(0);
  const clickSuppressed = useCallback(() => Date.now() < suppressClickUntil.current, []);

  const pointToMin = useCallback(
    (clientY: number): number => {
      const el = gridRef.current;
      if (!el) return gridMin;
      const top = el.getBoundingClientRect().top;
      const raw = gridMin + ((clientY - top) / rowH) * 60;
      return Math.min(gridMax, Math.max(gridMin, Math.round(raw / SNAP) * SNAP));
    },
    [gridMin, gridMax, rowH],
  );

  /** legal time window of ONE day: personal = the full grid (00–24),
   *  team = that day's working window (shifts must stay inside it — the
   *  server rejects anything else with a 400 "window") */
  const windowOfDay = useCallback(
    (key: string): { start: number; end: number } => {
      if (personalMode) return { start: gridMin, end: gridMax };
      const w = DAY_WINDOWS[dateFromKey(key).getDay()];
      return w ? { start: w.start, end: w.end } : { start: gridMin, end: gridMax };
    },
    [personalMode, gridMin, gridMax],
  );

  /** which day column sits under the point (works for RTL too — no mirroring math) */
  const dayFromPoint = useCallback((x: number, y: number): { idx: number; date: string } | null => {
    const el = document.elementFromPoint(x, y);
    const col = el?.closest<HTMLElement>("[data-pd-col]");
    if (!col) return null;
    const idx = Number(col.dataset.pdCol);
    const date = col.dataset.pdDate;
    if (!Number.isFinite(idx) || !date) return null;
    return { idx, date };
  }, []);

  /** glide the page when dragging near the viewport edges */
  const autoScroll = useCallback((y: number) => {
    const vh = window.innerHeight;
    if (y < 64) window.scrollBy(0, -12);
    else if (y > vh - 64) window.scrollBy(0, 12);
  }, []);

  /* ---------- Google-style drag-to-create (both calendar modes) ---------- */
  const beginSelection = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!canDrag || dragRef.current) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const day = dayFromPoint(e.clientX, e.clientY);
      if (!day) return;
      /* the range must stay inside the day's own legal window */
      const w = windowOfDay(day.date);
      const anchorMin = Math.min(Math.max(pointToMin(e.clientY), w.start), w.end);
      const startClient = { x: e.clientX, y: e.clientY };
      let lastClient = { ...startClient };

      const applySel = (bMin: number) => {
        const bb = Math.min(Math.max(bMin, w.start), w.end);
        const next = {
          dayIdx: day.idx,
          aMin: Math.min(anchorMin, bb),
          bMin: Math.max(anchorMin, bb),
        };
        selRef.current = next;
        setSel(next);
      };
      const clearSel = () => {
        selRef.current = null;
        setSel(null);
      };

      const onMove = (ev: PointerEvent) => {
        const d = dragRef.current;
        if (!d || ev.pointerId !== d.pointerId) return;
        lastClient = { x: ev.clientX, y: ev.clientY };
        if (!d.armed) {
          // touch, long-press still pending: a real move means the user is
          // scrolling — abort the pending selection (the scroll driver takes over)
          if (Math.hypot(ev.clientX - startClient.x, ev.clientY - startClient.y) > TOUCH_SLOP) {
            d.cleanup();
          }
          return;
        }
        applySel(pointToMin(ev.clientY));
        autoScroll(ev.clientY);
      };

      const onUp = (ev: PointerEvent) => {
        const d = dragRef.current;
        if (!d || ev.pointerId !== d.pointerId) return;
        const s = selRef.current;
        const armed = d.armed;
        d.cleanup();
        if (!armed || !s || s.bMin - s.aMin < SNAP) {
          // plain click / tap on an empty slot → default one-hour event,
          // start snapped down to the nearest 15 min (Google's default duration);
          // the band becomes the preview of the pending one-hour event
          const start = Math.min(anchorMin, w.end - 60);
          applySel(start + 60);
          onCreateAt?.({
            date: day.date,
            startMin: start,
            endMin: Math.min(start + 60, w.end),
            anchor: lastClient,
          });
          return;
        }
        onCreateAt?.({ date: day.date, startMin: s.aMin, endMin: s.bMin, anchor: lastClient });
      };

      const onCancelSelection = () => {
        const d = dragRef.current;
        d?.cleanup();
        clearSel();
      };
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key === "Escape") onCancelSelection();
      };

      const session: DragSession = {
        pointerId: e.pointerId,
        armed: e.pointerType === "mouse",
        timer: undefined,
        cleanup: () => {
          const d = dragRef.current;
          if (d?.timer) window.clearTimeout(d.timer);
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          window.removeEventListener("pointercancel", onCancelSelection);
          window.removeEventListener("keydown", onKey);
          dragRef.current = null;
        },
      };
      dragRef.current = session;

      if (session.armed) {
        e.preventDefault(); // no text selection while rubber-banding
        applySel(anchorMin);
      } else {
        // touch / pen: hold still to arm the selection, then drag
        session.timer = window.setTimeout(() => {
          const d = dragRef.current;
          if (!d) return;
          d.armed = true;
          navigator.vibrate?.(18);
          applySel(anchorMin);
        }, LONG_PRESS_MS);
      }
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancelSelection);
      window.addEventListener("keydown", onKey);
    },
    [canDrag, dayFromPoint, pointToMin, windowOfDay, autoScroll, onCreateAt],
  );

  /* ---------- Google-style move / resize of existing blocks ----------
   * Works for both block kinds: a private event (personal mode) and a shared
   * shift (team mode). The only differences are the candidate pool for swaps
   * and the legal time window clamps (shifts must stay inside DAY_WINDOWS). */
  const beginBlockDrag = useCallback(
    (e: React.PointerEvent, item: DragItem, kind: "move" | "resize") => {
      if (!canMove || dragRef.current) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      const isTouch = e.pointerType !== "mouse";
      const startClient = { x: e.clientX, y: e.clientY };
      const origin = { date: itemDate(item), start: itemStart(item), end: itemEnd(item) };
      const dur = Math.max(origin.end - origin.start, SNAP);
      const grabOffset = kind === "move" ? pointToMin(e.clientY) - origin.start : 0;
      const originId = itemId(item);
      let curDateKey = origin.date;

      const applyBlock = (
        dateKeyStr: string,
        startMin: number,
        endMin: number,
        swap: BlockDrag["swap"],
      ) => {
        const next: BlockDrag = {
          kind,
          item,
          originDate: origin.date,
          dateKey: dateKeyStr,
          startMin,
          endMin,
          moved: true,
          swap,
        };
        blockDragRef.current = next;
        setBlockDrag(next);
      };

      /** move: new times + cross-day column + same-day neighbour swap */
      const computeMove = (clientX: number, clientY: number) => {
        let start = Math.round((pointToMin(clientY) - grabOffset) / SNAP) * SNAP;
        const day = dayFromPoint(clientX, clientY);
        const dk = day?.date ?? curDateKey;
        curDateKey = dk;
        const w = windowOfDay(dk);
        let swap: BlockDrag["swap"] = null;
        if (dk === origin.date) {
          // same day only: if the new range covers exactly one neighbour,
          // the two blocks exchange slots (Google-style "swap")
          const end = start + dur;
          const pool: Array<{ date: string; startMin: number; endMin: number; ref: DragItem }> =
            item.type === "personal"
              ? visiblePersonal
                  .filter((o) => !o.allDay && o.date === dk && baseId(o.id) !== originId)
                  .map((ev) => ({ date: ev.date, startMin: ev.startMin, endMin: ev.endMin, ref: { type: "personal", ev } as DragItem }))
              : shifts
                  .filter((o) => o.date === dk && o.id !== originId)
                  .map((sh) => ({ date: sh.date, startMin: sh.startMin, endMin: sh.endMin, ref: { type: "shift", shift: sh } as DragItem }));
          const cands = pool.filter((o) => o.startMin < end && o.endMin > start);
          if (cands.length === 1) {
            const cand = cands[0];
            const candDur = Math.max(cand.endMin - cand.startMin, SNAP);
            const cStart = Math.min(Math.max(origin.start, w.start), w.end - candDur);
            swap = { item: cand.ref, startMin: cStart, endMin: cStart + candDur };
            start = cand.startMin; // the dragged block snaps into the neighbour's slot
          }
        }
        start = Math.min(Math.max(start, w.start), w.end - dur);
        return { dk, start, end: start + dur, swap };
      };

      const onMove = (pe: PointerEvent) => {
        const d = dragRef.current;
        if (!d || pe.pointerId !== d.pointerId) return;
        if (!d.armed) {
          // touch, long-press still pending: a real move means the user is
          // scrolling — abort the pending drag (the scroll driver takes over)
          if (Math.hypot(pe.clientX - startClient.x, pe.clientY - startClient.y) > TOUCH_SLOP) {
            d.cleanup();
          }
          return;
        }
        if (kind === "move") {
          const r = computeMove(pe.clientX, pe.clientY);
          applyBlock(r.dk, r.start, r.end, r.swap);
        } else {
          // resize stays on the block's own day, clamped to its window
          const wEnd = windowOfDay(origin.date).end;
          const end = Math.max(pointToMin(pe.clientY), origin.start + SNAP);
          applyBlock(
            origin.date,
            origin.start,
            Math.min(Math.round(end / SNAP) * SNAP, wEnd),
            null,
          );
        }
        autoScroll(pe.clientY);
      };

      const onUp = () => {
        const d = dragRef.current;
        const s = blockDragRef.current;
        d?.cleanup();
        blockDragRef.current = null;
        setBlockDrag(null);
        if (!s?.moved) return; // a plain press / long-press → click opens the editor
        const samePlace =
          s.dateKey === origin.date &&
          s.startMin === origin.start &&
          s.endMin === origin.end;
        if (samePlace && !s.swap) return;
        suppressClickUntil.current = Date.now() + 400;
        if (item.type === "personal") {
          onMovePersonal?.({
            event: item.ev,
            date: s.dateKey !== origin.date ? s.dateKey : undefined,
            startMin: s.startMin,
            endMin: s.endMin,
            swapWith: s.swap
              ? {
                  event: s.swap.item.type === "personal" ? s.swap.item.ev : item.ev,
                  startMin: s.swap.startMin,
                  endMin: s.swap.endMin,
                }
              : null,
          });
        } else {
          onMoveShift?.({
            shift: item.shift,
            date: s.dateKey !== origin.date ? s.dateKey : undefined,
            startMin: s.startMin,
            endMin: s.endMin,
            swapWith: s.swap
              ? {
                  shift: s.swap.item.type === "shift" ? s.swap.item.shift : item.shift,
                  startMin: s.swap.startMin,
                  endMin: s.swap.endMin,
                }
              : null,
          });
        }
      };

      const onCancel = () => {
        const d = dragRef.current;
        d?.cleanup();
        blockDragRef.current = null;
        setBlockDrag(null);
      };
      const onKey = (ke: KeyboardEvent) => {
        if (ke.key === "Escape") onCancel();
      };

      const session: DragSession = {
        pointerId: e.pointerId,
        armed: !isTouch,
        timer: undefined,
        cleanup: () => {
          const d = dragRef.current;
          if (d?.timer) window.clearTimeout(d.timer);
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          window.removeEventListener("pointercancel", onCancel);
          window.removeEventListener("keydown", onKey);
          dragRef.current = null;
        },
      };
      dragRef.current = session;

      if (session.armed) {
        // mouse: the ghost follows from the first pixel of movement
      } else {
        // touch / pen: hold still to arm the drag (the grid sets
        // touch-action:none and the scroll driver owns panning, so the
        // browser can never cancel the gesture with a pointercancel)
        session.timer = window.setTimeout(() => {
          const d = dragRef.current;
          if (!d) return;
          d.armed = true;
          navigator.vibrate?.(18);
          applyBlock(curDateKey, origin.start, origin.end, null);
        }, LONG_PRESS_MS);
      }
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      window.addEventListener("keydown", onKey);
    },
    [
      canMove,
      onMovePersonal,
      onMoveShift,
      pointToMin,
      dayFromPoint,
      windowOfDay,
      autoScroll,
      visiblePersonal,
      shifts,
    ],
  );

  /** adapters so each block component keeps its typed callback signature */
  const beginPersonalDrag = useCallback(
    (e: React.PointerEvent, ev: PersonalEvent, kind: "move" | "resize") =>
      beginBlockDrag(e, { type: "personal", ev }, kind),
    [beginBlockDrag],
  );
  const beginShiftDrag = useCallback(
    (e: React.PointerEvent, shift: Shift, kind: "move" | "resize") =>
      beginBlockDrag(e, { type: "shift", shift }, kind),
    [beginBlockDrag],
  );

  /* ---------- custom touch scrolling (grid has touch-action: none) ----------
   * The browser would otherwise decide pan-vs-drag on its own and cancel the
   * drag with a pointercancel after a tiny finger drift. Owning the gesture
   * makes both behaviours deterministic: an unarmed touch that moves >10 px
   * scrolls the page (1:1, with a light momentum on release), an armed touch
   * is always a calendar drag. */
  useEffect(() => {
    if (!canDrag && !canMove) return;
    const el = gridRef.current;
    if (!el) return;

    let touchId: number | null = null;
    let startY = 0;
    let startScroll = 0;
    let lastY = 0;
    let lastT = 0;
    let vel = 0; // px/ms, finger velocity while scrolling
    let scrolling = false;
    let momentum = 0; // rAF id

    const stopMomentum = () => {
      if (momentum) {
        cancelAnimationFrame(momentum);
        momentum = 0;
      }
    };

    const onTouchStart = (te: TouchEvent) => {
      if (touchId !== null) return; // single-finger driver — ignore extra fingers
      const t = te.changedTouches[0];
      touchId = t.identifier;
      startY = t.clientY;
      startScroll = window.scrollY;
      lastY = t.clientY;
      lastT = performance.now();
      vel = 0;
      scrolling = false;
      stopMomentum();
    };

    const onTouchMove = (te: TouchEvent) => {
      if (touchId === null) return;
      const t = Array.from(te.changedTouches).find((x) => x.identifier === touchId);
      if (!t) return;
      // never let the browser take the gesture over (pan / zoom / pointercancel)
      te.preventDefault();
      const armed = !!dragRef.current?.armed;
      const nowT = performance.now();
      if (!armed) {
        const dy = t.clientY - startY;
        if (!scrolling && Math.abs(dy) > TOUCH_SLOP) scrolling = true;
        if (scrolling) {
          window.scrollTo(0, startScroll - dy);
          const dt = nowT - lastT;
          if (dt > 0) vel = 0.8 * vel + 0.2 * ((t.clientY - lastY) / dt);
        }
      }
      lastY = t.clientY;
      lastT = nowT;
    };

    const onTouchEnd = (te: TouchEvent) => {
      if (touchId === null) return;
      const found = Array.from(te.changedTouches).some((x) => x.identifier === touchId);
      if (!found) return;
      touchId = null;
      if (te.type !== "touchcancel" && scrolling && Math.abs(vel) > 0.05) {
        const step = () => {
          vel *= 0.94;
          if (Math.abs(vel) < 0.02) {
            momentum = 0;
            return;
          }
          window.scrollBy(0, -vel * 16);
          momentum = requestAnimationFrame(step);
        };
        momentum = requestAnimationFrame(step);
      }
      scrolling = false;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      stopMomentum();
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [canDrag, canMove]);

  /* a drag left running when the grid unmounts (view switch) must not leak
   * its window listeners / long-press timer */
  useEffect(() => {
    return () => dragRef.current?.cleanup();
  }, []);

  /* the quick-create popup (rendered by the page) clears the pending
   * rubber-band when it closes — save, cancel or «Подробнее» */
  useEffect(() => {
    const clear = () => {
      selRef.current = null;
      setSel(null);
    };
    window.addEventListener("gymshift:clear-drag-selection", clear);
    return () => window.removeEventListener("gymshift:clear-drag-selection", clear);
  }, []);

  /* long-press on iOS/Android must not raise text-selection callouts */
  const noCalloutStyle = canDrag || canMove ? { WebkitTouchCallout: "none" as const } : undefined;

  /* personal-mode empty state — the grid stays interactive (drag-to-create),
   * a slim hint banner replaces the old "nothing here" card */
  if (personalMode && visiblePersonal.length === 0 && !canDrag) {
    return (
      <div
        className="flex flex-col items-center gap-2 rounded-2xl border border-dashed p-8 text-center"
        style={{
          borderColor: "color-mix(in srgb, var(--primary) 30%, transparent)",
          background: "color-mix(in srgb, var(--primary) 4%, transparent)",
        }}
      >
        <span
          className="flex size-11 items-center justify-center rounded-2xl"
          style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)" }}
        >
          <Lock className="size-5" style={{ color: "var(--primary)" }} aria-hidden="true" />
        </span>
        <p className="text-sm font-medium">{t.personal.empty}</p>
        <p className="max-w-xs text-xs text-muted-foreground">{t.personal.emptyHint}</p>
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
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {personalMode && visiblePersonal.length === 0 && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed px-3.5 py-2.5"
          style={{
            borderColor: "color-mix(in srgb, var(--primary) 30%, transparent)",
            background: "color-mix(in srgb, var(--primary) 5%, transparent)",
          }}
        >
          <p className="min-w-0 flex-1 text-xs text-muted-foreground">{t.personal.dragHint}</p>
          {onAddPersonal && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 shrink-0 gap-1.5 rounded-lg border-dashed"
              style={{ borderColor: "color-mix(in srgb, var(--primary) 45%, transparent)" }}
              onClick={onAddPersonal}
            >
              <CalendarPlus className="size-3.5 text-primary" aria-hidden="true" />
              {t.personal.add}
            </Button>
          )}
        </div>
      )}
      <div className={`overflow-x-auto scroll-slim ${compact ? "overflow-x-visible" : ""}`}>
        <div style={{ minWidth: minGridWidth || undefined }}>
          {/* day headers */}
          <div className="grid border-b border-border bg-bg-header/60" style={{ gridTemplateColumns: cols }}>
            <div aria-hidden="true" />
            {days.map((d) => {
              const isToday = dateKey(d) === nowKey;
              return (
                <div key={dateKey(d)} className="flex min-w-0 flex-col items-center gap-0.5 py-1.5 sm:py-2">
                  <span
                    className={`text-muted-foreground ${compact ? "text-[0.625rem]" : "text-[0.6875rem]"}`}
                  >
                    {fmtWeekdayShort(d, lang)}
                  </span>
                  <span
                    className={`flex items-center justify-center rounded-full text-sm font-semibold ${
                      compact ? "size-6 text-[0.8125rem]" : "size-7"
                    } ${isToday ? "bg-primary text-primary-foreground" : ""}`}
                  >
                    {d.getDate()}
                  </span>
                </div>
              );
            })}
          </div>

          {/* all-day band — Google-style: full-width chips above the timeline,
              stacked per day; the gutter carries the «Весь день» label */}
          {showAllDayBand && (
            <div className="grid border-b border-border" style={{ gridTemplateColumns: cols }}>
              <div className="relative border-e border-border" aria-hidden="true">
                <span
                  className={`absolute bottom-1 end-1 whitespace-nowrap text-muted-foreground ${
                    compact ? "text-[0.5rem]" : "text-[0.5625rem]"
                  }`}
                >
                  {t.personal.allDay}
                </span>
              </div>
              {allDayByDay.map((list, i) => {
                const isWeekend = days[i].getDay() === 5 || days[i].getDay() === 6;
                return (
                  <div
                    key={dateKey(days[i])}
                    className={`min-w-0 border-e border-border px-0.5 py-0.5 last:border-e-0 ${
                      isWeekend ? "bg-secondary/30" : ""
                    }`}
                    style={{ minHeight: allDayBandH }}
                  >
                    {list.map((e) => {
                      const c = e.color ?? "var(--primary)";
                      const recurring = !!e.repeat && e.repeat !== "none";
                      return (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => onEditPersonal?.(e)}
                          className="flex w-full items-center gap-1 overflow-hidden rounded-md px-1 text-start transition-transform hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          style={{
                            height: allDayChipH,
                            marginBottom: 3,
                            background: `color-mix(in srgb, ${c} 12%, transparent)`,
                            borderInlineStart: `3px solid ${c}`,
                          }}
                          title={e.title}
                        >
                          <Lock className="size-2.5 shrink-0" style={{ color: c }} aria-hidden="true" />
                          <span className="block truncate text-[0.625rem] font-bold leading-tight">
                            {e.title}
                          </span>
                          {recurring && (
                            <Repeat
                              className="size-2.5 shrink-0 opacity-70"
                              style={{ color: c }}
                              aria-label={e.repeat ?? undefined}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* time grid */}
          <div
            ref={gridRef}
            className={`grid ${canDrag || canMove ? "select-none" : ""}`}
            style={{
              gridTemplateColumns: cols,
              height: gridH,
              touchAction: canDrag || canMove ? "none" : undefined,
              ...noCalloutStyle,
            }}
            onPointerDown={canDrag ? beginSelection : undefined}
            onContextMenu={
              canDrag || canMove ? (ev) => ev.preventDefault() : undefined
            }
          >
            {/* hour labels — every hour in personal mode, every 2 h in team mode;
                full times on desktop, bare hour digits on compact */}
            <div className="relative border-e border-border" aria-hidden="true">
              {labels.map((h) => (
                <div
                  key={h}
                  dir="ltr"
                  className={`absolute -translate-y-1/2 tabular-nums text-muted-foreground end-1 ${
                    compact ? "text-[0.5625rem]" : "text-[0.6875rem] end-1.5"
                  }`}
                  style={{ top: (h - win.startH) * rowH }}
                >
                  {compact ? h : `${pad(h)}:00`}
                </div>
              ))}
            </div>

            {/* day columns */}
            {days.map((d, idx) => {
              const key = dateKey(d);
              const dayShifts = shifts.filter((s) => s.date === key);
              const placed = assignLanes(dayShifts);
              const dayPersonal = visiblePersonal.filter((e) => e.date === key);
              const timedPersonal = dayPersonal.filter((e) => !e.allDay);
              const timedPlaced = assignLanes(timedPersonal);
              const showNow =
                key === nowKey && nowMin >= gridMin && nowMin < win.endH * 60;
              const isWeekend = d.getDay() === 5 || d.getDay() === 6;
              /* a block dragged in from another day renders as a ghost here */
              const ghost =
                blockDrag && blockDrag.kind === "move" && blockDrag.dateKey === key && blockDrag.originDate !== key
                  ? blockDrag
                  : null;
              return (
                <div
                  key={key}
                  data-pd-col={idx}
                  data-pd-date={key}
                  className={`relative border-e border-border last:border-e-0 ${isWeekend ? "bg-secondary/30" : ""}`}
                >
                  {labels.map((h) => (
                    <div
                      key={h}
                      aria-hidden="true"
                      className={`absolute inset-x-0 ${h === labels[0] ? "border-t border-border/60" : "border-t border-border/70"}`}
                      style={{ top: (h - win.startH) * rowH }}
                    />
                  ))}
                  {/* faint half-hour lines — Google look, desktop personal mode */}
                  {personalMode &&
                    !compact &&
                    labels.slice(0, -1).map((h) => (
                      <div
                        key={`half-${h}`}
                        aria-hidden="true"
                        className="absolute inset-x-0 border-t border-border/30"
                        style={{ top: (h + 0.5 - win.startH) * rowH }}
                      />
                    ))}
                  {showNow && (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-20"
                      style={{ top: ((nowMin - gridMin) / 60) * rowH }}
                      aria-hidden="true"
                    >
                      <div className="h-0.5 bg-rose-500" />
                      <div className="absolute -top-[3px] size-2 rounded-full bg-rose-500 ltr:-start-1 rtl:-end-1" />
                    </div>
                  )}
                  {!personalMode &&
                    placed.map(({ item: shift, lane, total }) => {
                      const isDragged =
                        !!blockDrag &&
                        blockDrag.item.type === "shift" &&
                        blockDrag.item.shift.id === shift.id;
                      // the shift left this column — it lives in the target day now
                      if (isDragged && blockDrag.dateKey !== key) return null;
                      const swapPreview =
                        blockDrag?.swap?.item.type === "shift" &&
                        blockDrag.swap.item.shift.id === shift.id
                          ? { startMin: blockDrag.swap.startMin, endMin: blockDrag.swap.endMin }
                          : null;
                      return (
                        <ShiftBlock
                          key={shift.id}
                          shift={shift}
                          trainer={trainers.get(shift.trainerId)}
                          lang={lang}
                          t={t}
                          rowH={rowH}
                          startH={win.startH}
                          showTrainer={days.length <= 3}
                          compact={compact}
                          lane={lane}
                          total={total}
                          onEdit={onEdit}
                          onDelete={onDelete}
                          onBlockPointerDown={canMove ? beginShiftDrag : undefined}
                          clickSuppressed={canMove ? clickSuppressed : undefined}
                          dragOverride={
                            isDragged
                              ? { startMin: blockDrag.startMin, endMin: blockDrag.endMin }
                              : swapPreview
                          }
                        />
                      );
                    })}
                  {/* private timed events — personal mode ONLY. PRIVACY: the
                      shared team calendar never renders private events, not
                      even the owner's own ones (they live exclusively in the
                      personal calendar; all-day ones in the band above). */}
                  {personalMode && onEditPersonal && (
                    <>
                      {timedPlaced.map(({ item: e, lane, total }) => {
                        const isDragged =
                          !!blockDrag &&
                          blockDrag.item.type === "personal" &&
                          baseId(blockDrag.item.ev.id) === baseId(e.id);
                        // the block left this column — it lives in the target day now
                        if (isDragged && blockDrag.dateKey !== key) return null;
                        const swapPreview =
                          blockDrag?.swap?.item.type === "personal" &&
                          baseId(blockDrag.swap.item.ev.id) === baseId(e.id)
                            ? {
                                startMin: blockDrag.swap.startMin,
                                endMin: blockDrag.swap.endMin,
                              }
                            : null;
                        return (
                          <PersonalBlock
                            key={e.id}
                            event={e}
                            rowH={rowH}
                            startH={win.startH}
                            endH={win.endH}
                            compact={compact}
                            lane={lane}
                            total={total}
                            onEdit={onEditPersonal}
                            onBlockPointerDown={canMove ? beginPersonalDrag : undefined}
                            clickSuppressed={canMove ? clickSuppressed : undefined}
                            dragOverride={
                              isDragged
                                ? { startMin: blockDrag.startMin, endMin: blockDrag.endMin }
                                : swapPreview
                            }
                          />
                        );
                      })}
                      {ghost?.item.type === "personal" && (
                        <PersonalBlock
                          event={ghost.item.ev}
                          rowH={rowH}
                          startH={win.startH}
                          endH={win.endH}
                          compact={compact}
                          onEdit={onEditPersonal}
                          ghost
                          dragOverride={{ startMin: ghost.startMin, endMin: ghost.endMin }}
                        />
                      )}
                    </>
                  )}
                  {/* cross-day ghost of a dragged shared shift (team mode) */}
                  {ghost?.item.type === "shift" && (
                    <ShiftBlock
                      shift={ghost.item.shift}
                      trainer={trainers.get(ghost.item.shift.trainerId)}
                      lang={lang}
                      t={t}
                      rowH={rowH}
                      startH={win.startH}
                      showTrainer={days.length <= 3}
                      compact={compact}
                      ghost
                      dragOverride={{ startMin: ghost.startMin, endMin: ghost.endMin }}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  )}
                  {/* live drag selection — mirrors Google's rubber-band block */}
                  {sel && sel.dayIdx === idx && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-1 z-30 rounded-lg border-2 border-dashed"
                      style={{
                        top: ((sel.aMin - gridMin) / 60) * rowH,
                        height: Math.max(((sel.bMin - sel.aMin) / 60) * rowH, 4),
                        background: "color-mix(in srgb, var(--primary) 16%, transparent)",
                        borderColor: "color-mix(in srgb, var(--primary) 75%, transparent)",
                      }}
                    >
                      <span
                        dir="ltr"
                        className="absolute top-0.5 start-1 rounded bg-card/85 px-1 text-[0.625rem] font-bold tabular-nums"
                        style={{ color: "var(--primary)" }}
                      >
                        {minToHHMM(sel.aMin)}–{minToHHMM(sel.bMin)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
