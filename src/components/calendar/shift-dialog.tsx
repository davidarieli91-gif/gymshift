"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DAY_WINDOWS } from "@/lib/constants";
import { dateFromKey, dateKey, minToHHMM } from "@/lib/format";
import type { Dict } from "@/lib/i18n";
import type { Trainer } from "@/lib/types";

interface ShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** shift being edited, or null when adding */
  shift: { id: string; date: string; trainerId: string; startMin: number; endMin: number; note?: string | null } | null;
  /** date/trainer/time prefill — times come from a grid drag-create */
  defaults: { date?: string; trainerId?: string; startMin?: number; endMin?: number };
  trainers: Trainer[];
  t: Dict;
  /** resolves on success (dialog closes), rejects on failure (dialog stays open) */
  onSave: (draft: { date: string; trainerId: string; startMin: number; endMin: number; note?: string }) => Promise<void>;
}

const STEP = 15;

/** minutes win.start..win.end inclusive, 15-min steps */
function stepOptions(start: number, end: number): number[] {
  const out: number[] = [];
  const first = Math.ceil(start / STEP) * STEP;
  for (let m = first; m <= end; m += STEP) out.push(m);
  return out;
}

export interface ShiftDraft {
  date: string;
  trainerId: string;
  startMin: number;
  endMin: number;
  note?: string;
}

/** Add / edit shift: trainer, date, start/end (15-min steps inside that day's window), note */
export function ShiftDialog({
  open,
  onOpenChange,
  shift,
  defaults,
  trainers,
  t,
  onSave,
}: ShiftDialogProps) {
  const [trainerId, setTrainerId] = useState(
    shift?.trainerId ?? defaults.trainerId ?? trainers[0]?.id ?? "",
  );
  const [date, setDate] = useState(shift?.date ?? defaults.date ?? dateKey(new Date()));
  const [startMin, setStartMin] = useState(shift?.startMin ?? defaults.startMin ?? 450);
  const [endMin, setEndMin] = useState(
    shift?.endMin ?? defaults.endMin ?? (defaults.startMin ?? 450) + 60,
  );
  const [note, setNote] = useState(shift?.note ?? "");
  const [saving, setSaving] = useState(false);

  const win = useMemo(() => {
    const wd = /^\d{4}-\d{2}-\d{2}$/.test(date) ? dateFromKey(date).getDay() : 0;
    return DAY_WINDOWS[wd];
  }, [date]);

  const startOpts = useMemo(() => stepOptions(win.start, win.end - STEP), [win]);
  const endOpts = useMemo(() => stepOptions(startMin + STEP, win.end), [win, startMin]);

  /** keep both times inside the window of the SELECTED date */
  const changeDate = (v: string) => {
    setDate(v);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
    const w = DAY_WINDOWS[dateFromKey(v).getDay()];
    const s = Math.min(Math.max(startMin, w.start), w.end - STEP);
    setStartMin(s);
    setEndMin(Math.min(Math.max(endMin, s + STEP), w.end));
  };

  const valid = trainerId !== "" && /^\d{4}-\d{2}-\d{2}$/.test(date) && endMin > startMin;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onSave({
        date,
        trainerId,
        startMin,
        endMin,
        note: note.trim() ? note.trim() : undefined,
      });
      onOpenChange(false);
    } catch {
      /* server error toasts are handled by the mutation in page.tsx */
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{shift ? t.editShift : t.addShift}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-4 py-1" noValidate>
          <div className="grid gap-2">
            <Label htmlFor="shift-trainer">{t.fields.trainer}</Label>
            <Select value={trainerId} onValueChange={setTrainerId}>
              <SelectTrigger id="shift-trainer" className="min-h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {trainers.map((tr) => (
                  <SelectItem key={tr.id} value={tr.id}>
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="size-2.5 rounded-full"
                        style={{ background: tr.color }}
                      />
                      {tr.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="shift-date">{t.fields.date}</Label>
            <Input
              id="shift-date"
              type="date"
              value={date}
              onChange={(e) => changeDate(e.target.value)}
              className="min-h-11 [direction:ltr]"
            />
            <p className="text-[0.6875rem] text-muted-foreground">
              {t.fields.windowHint}:{" "}
              <span dir="ltr" className="tabular-nums">
                {minToHHMM(win.start)}–{minToHHMM(win.end)}
              </span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="shift-start">{t.fields.start}</Label>
              <Select
                value={String(startMin)}
                onValueChange={(v) => {
                  const m = Number(v);
                  setStartMin(m);
                  if (endMin <= m) setEndMin(Math.min(m + 60, win.end));
                }}
              >
                <SelectTrigger id="shift-start" className="min-h-11 w-full" dir="ltr">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {startOpts.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {minToHHMM(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="shift-end">{t.fields.end}</Label>
              <Select value={String(endMin)} onValueChange={(v) => setEndMin(Number(v))}>
                <SelectTrigger id="shift-end" className="min-h-11 w-full" dir="ltr">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {endOpts.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {minToHHMM(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="shift-note">{t.fields.note}</Label>
            <Input
              id="shift-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.fields.notePh}
              maxLength={80}
              className="min-h-11"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.btn.cancel}
            </Button>
            <Button type="submit" disabled={!valid || saving}>
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {t.btn.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
