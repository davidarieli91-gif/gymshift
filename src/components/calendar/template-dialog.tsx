"use client";

import { useMemo, useState } from "react";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DAY_WINDOWS, STANDARD_SHIFTS } from "@/lib/constants";
import { addDays, dateKey, fmtRangeShort, fmtWeekdayShort, minToHHMM } from "@/lib/format";
import type { Dict } from "@/lib/i18n";
import type { Lang, TemplateSlot, TemplateSlotInput, Trainer } from "@/lib/types";

interface DraftSlot {
  key: string;
  weekday: number;
  trainerId: string;
  startMin: number;
  endMin: number;
}

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slots: TemplateSlot[];
  trainers: Trainer[];
  isAdmin: boolean;
  lang: Lang;
  t: Dict;
  saving: boolean;
  applying: boolean;
  onSaveTemplate: (slots: TemplateSlotInput[]) => Promise<TemplateSlot[]>;
  onApplyTemplate: (from: string) => Promise<number>;
}

const STEP = 15;

/** minutes win.start..win.end inclusive, 15-min steps */
function stepOptions(start: number, end: number): number[] {
  const out: number[] = [];
  const first = Math.ceil(start / STEP) * STEP;
  for (let m = first; m <= end; m += STEP) out.push(m);
  return out;
}

function fromServer(slots: TemplateSlot[]): DraftSlot[] {
  return slots.map((s, i) => ({
    key: `s${i}-${s.id}`,
    weekday: s.weekday,
    trainerId: s.trainerId,
    startMin: s.startMin,
    endMin: s.endMin,
  }));
}

/**
 * Weekly standard-shifts template.
 * Everyone can view; admin edits slots and applies the template to a week.
 * Single-column adaptive layout: one full-width row per weekday, so nothing
 * is squeezed on a phone; admins get one-tap standard-shift presets per day.
 */
export function TemplateDialog({
  open,
  onOpenChange,
  slots,
  trainers,
  isAdmin,
  lang,
  t,
  saving,
  applying,
  onSaveTemplate,
  onApplyTemplate,
}: TemplateDialogProps) {
  const [draft, setDraft] = useState<DraftSlot[]>(() => fromServer(slots));
  const [applyOpen, setApplyOpen] = useState(false);
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d;
  });

  // merge live trainer list with briefs embedded in server slots (deleted trainers keep their label)
  const briefById = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    for (const s of slots) if (s.trainer) map.set(s.trainerId, s.trainer);
    for (const tr of trainers) map.set(tr.id, { name: tr.name, color: tr.color });
    return map;
  }, [slots, trainers]);

  const nameOf = (slot: DraftSlot) => briefById.get(slot.trainerId)?.name ?? "—";
  const colorOf = (slot: DraftSlot) => briefById.get(slot.trainerId)?.color ?? "#94a3b8";

  const addSlot = (slot: DraftSlot) =>
    setDraft((prev) => [...prev, { ...slot, key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }]);

  const removeSlot = (key: string) => setDraft((prev) => prev.filter((s) => s.key !== key));

  const save = async () => {
    try {
      const saved = await onSaveTemplate(
        draft.map(({ weekday, trainerId, startMin, endMin }) => ({ weekday, trainerId, startMin, endMin })),
      );
      setDraft(fromServer(saved));
    } catch {
      /* error toast is shown by the mutation in page.tsx */
    }
  };

  const apply = async () => {
    try {
      await onApplyTemplate(dateKey(weekStart));
      setApplyOpen(false);
    } catch {
      /* error toast is shown by the mutation in page.tsx */
    }
  };

  // known Sunday for stable weekday labels
  const baseSunday = useMemo(() => new Date(2024, 8, 1), []);
  const weekEnd = addDays(weekStart, 6);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="flex max-h-[92dvh] flex-col gap-3 overflow-hidden sm:max-w-2xl"
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <CalendarClock className="size-4 shrink-0 text-primary" aria-hidden="true" />
            {t.template.title}
            {draft.length > 0 && (
              <span className="text-xs font-normal text-muted-foreground">
                · {t.template.count(draft.length)}
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {isAdmin ? t.template.desc : t.template.readonlyHint}
          </DialogDescription>
        </DialogHeader>

        {!isAdmin && (
          <p className="flex shrink-0 items-center gap-1.5 rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
            <Info className="size-3.5 shrink-0" aria-hidden="true" />
            {t.template.readonlyHint}
          </p>
        )}

        <div className="scroll-slim min-h-0 flex-1 overflow-y-auto pe-1">
          <div className="flex flex-col gap-2">
            {Array.from({ length: 7 }, (_, wd) => {
              const win = DAY_WINDOWS[wd];
              const daySlots = draft
                .filter((s) => s.weekday === wd)
                .sort((a, b) => a.startMin - b.startMin);
              const isWeekend = wd === 5 || wd === 6;
              return (
                <section
                  key={wd}
                  className={`rounded-xl border border-border p-3 ${isWeekend ? "bg-secondary/40" : "bg-card"}`}
                >
                  <header className="flex items-baseline justify-between gap-2">
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                      {fmtWeekdayShort(addDays(baseSunday, wd), lang)}
                      {daySlots.length > 0 && (
                        <span
                          aria-hidden="true"
                          className="rounded-full bg-primary/10 px-1.5 text-[0.625rem] leading-4 font-semibold tabular-nums text-primary"
                        >
                          {daySlots.length}
                        </span>
                      )}
                    </h3>
                    <span dir="ltr" className="text-[0.625rem] font-normal tabular-nums text-muted-foreground">
                      {minToHHMM(win.start)}–{minToHHMM(win.end)}
                    </span>
                  </header>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {daySlots.length === 0 && (
                      <p className="py-0.5 text-[0.6875rem] text-muted-foreground">{t.template.empty}</p>
                    )}
                    {daySlots.map((s) => (
                      <div
                        key={s.key}
                        className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-border bg-background/60 py-1 ps-2 pe-1"
                      >
                        <span
                          aria-hidden="true"
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: colorOf(s) }}
                        />
                        <span className="max-w-[11ch] truncate text-xs font-medium sm:max-w-[16ch]">
                          {nameOf(s)}
                        </span>
                        <span dir="ltr" className="shrink-0 text-[0.625rem] tabular-nums text-muted-foreground">
                          {minToHHMM(s.startMin)}–{minToHHMM(s.endMin)}
                        </span>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => removeSlot(s.key)}
                            aria-label={`${t.btn.delete} ${nameOf(s)} ${minToHHMM(s.startMin)}`}
                            className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          >
                            <X className="size-3.5" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {isAdmin && (
                    <AddSlotRow
                      weekday={wd}
                      daySlots={daySlots}
                      trainers={trainers}
                      t={t}
                      onAdd={addSlot}
                    />
                  )}
                </section>
              );
            })}
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2 border-t border-border pt-3 sm:justify-between">
          <p className="hidden text-xs text-muted-foreground sm:block">{t.footerAutosave}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t.btn.close}
            </Button>
            {isAdmin && (
              <>
                <Button variant="outline" onClick={() => setApplyOpen(true)} disabled={draft.length === 0}>
                  {t.template.apply}
                </Button>
                <Button onClick={save} disabled={saving}>
                  {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                  {t.template.save}
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>

      {/* apply-to-week dialog with week navigation + confirm */}
      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.template.applyTitle}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="icon"
                className="size-9 rounded-lg"
                onClick={() => setWeekStart((w) => addDays(w, -7))}
                aria-label={t.template.applyWeek}
              >
                <ChevronLeft className="size-4 rtl:rotate-180" />
              </Button>
              <p dir="ltr" className="text-sm font-semibold">
                {fmtRangeShort(weekStart, weekEnd, lang)}
              </p>
              <Button
                variant="outline"
                size="icon"
                className="size-9 rounded-lg"
                onClick={() => setWeekStart((w) => addDays(w, 7))}
                aria-label={t.template.applyWeek}
              >
                <ChevronRight className="size-4 rtl:rotate-180" />
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              {draft.length > 0 ? t.template.count(draft.length) : t.template.empty}
            </p>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="h-11 w-full" disabled={applying || draft.length === 0}>
                  {applying && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                  {t.template.applyConfirm}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t.template.applyTitle}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t.template.applyWarn(fmtRangeShort(weekStart, weekEnd, lang))}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t.template.cancel}</AlertDialogCancel>
                  <AlertDialogAction onClick={apply}>{t.template.applyConfirm}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

interface AddSlotRowProps {
  weekday: number;
  daySlots: DraftSlot[];
  trainers: Trainer[];
  t: Dict;
  onAdd: (slot: DraftSlot) => void;
}

/**
 * Admin-only per-day editor:
 * 1. one-tap standard-shift presets (e.g. 07:30–12:00) for the selected trainer;
 * 2. trainer + custom start/end (15-min steps inside the day window).
 */
function AddSlotRow({ weekday, daySlots, trainers, t, onAdd }: AddSlotRowProps) {
  const win = DAY_WINDOWS[weekday];
  const presets = STANDARD_SHIFTS[weekday] ?? [];
  const [trainerId, setTrainerId] = useState(trainers[0]?.id ?? "");
  const [startMin, setStartMin] = useState(win.start);
  const [endMin, setEndMin] = useState(Math.min(win.start + 60, win.end));

  const startOpts = stepOptions(win.start, win.end - STEP);
  const endOpts = stepOptions(startMin + STEP, win.end);

  const changeStart = (v: string) => {
    const m = Number(v);
    setStartMin(m);
    if (endMin <= m) setEndMin(Math.min(m + 60, win.end));
  };

  const presetTaken = (ps: number, pe: number) =>
    daySlots.some((s) => s.trainerId === trainerId && s.startMin === ps && s.endMin === pe);

  const addPreset = (ps: number, pe: number) => {
    if (!trainerId || presetTaken(ps, pe)) return;
    onAdd({ key: "", weekday, trainerId, startMin: ps, endMin: pe });
  };

  const submit = () => {
    if (!trainerId || endMin <= startMin) return;
    onAdd({ key: "", weekday, trainerId, startMin, endMin });
    setStartMin(win.start);
    setEndMin(Math.min(win.start + 60, win.end));
  };

  return (
    <div className="mt-2.5 flex flex-col gap-1.5 border-t border-dashed border-border pt-2">
      <p className="text-[0.625rem] font-medium tracking-wide text-muted-foreground/90 uppercase">
        {t.template.quick}
      </p>

      <div className="flex flex-wrap gap-1">
        {presets.map(([ps, pe]) => {
          const taken = presetTaken(ps, pe);
          return (
            <button
              key={ps}
              type="button"
              onClick={() => addPreset(ps, pe)}
              disabled={!trainerId || taken}
              aria-label={`${t.template.add} ${minToHHMM(ps)}–${minToHHMM(pe)}`}
              className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[0.6875rem] font-medium tabular-nums transition-colors ${
                taken
                  ? "border-border/50 text-muted-foreground/50"
                  : "border-border bg-background/60 hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
              } disabled:pointer-events-none`}
            >
              {taken ? (
                <X aria-hidden="true" className="size-3" />
              ) : (
                <Plus aria-hidden="true" className="size-3" />
              )}
              <span dir="ltr">
                {minToHHMM(ps)}–{minToHHMM(pe)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
        <Select value={trainerId} onValueChange={setTrainerId}>
          <SelectTrigger size="sm" className="w-full text-xs sm:w-44" aria-label={t.fields.trainer}>
            <SelectValue placeholder={t.fields.trainer} />
          </SelectTrigger>
          <SelectContent>
            {trainers.map((tr) => (
              <SelectItem key={tr.id} value={tr.id} className="text-xs">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full"
                    style={{ background: tr.color }}
                  />
                  {tr.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5">
          <Select value={String(startMin)} onValueChange={changeStart}>
            <SelectTrigger size="sm" className="min-w-0 flex-1 text-xs sm:flex-none sm:min-w-20" dir="ltr" aria-label={t.fields.start}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {startOpts.map((m) => (
                <SelectItem key={m} value={String(m)} className="text-xs">
                  {minToHHMM(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span aria-hidden="true" className="text-[0.625rem] text-muted-foreground">
            –
          </span>

          <Select value={String(endMin)} onValueChange={(v) => setEndMin(Number(v))}>
            <SelectTrigger size="sm" className="min-w-0 flex-1 text-xs sm:flex-none sm:min-w-20" dir="ltr" aria-label={t.fields.end}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {endOpts.map((m) => (
                <SelectItem key={m} value={String(m)} className="text-xs">
                  {minToHHMM(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            size="icon"
            className="size-8 shrink-0 rounded-lg"
            onClick={submit}
            disabled={!trainerId || endMin <= startMin}
            aria-label={t.template.add}
          >
            <Plus className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
