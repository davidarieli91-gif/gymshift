"use client";

import { useMemo, useState } from "react";
import { Loader2, Lock, Repeat, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EventColorPicker } from "./personal-color-picker";
import { dateKey, minToHHMM } from "@/lib/format";
import type { Dict } from "@/lib/i18n";
import type { Lang, PersonalEvent, RepeatKind } from "@/lib/types";

interface PersonalEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** event being edited, or null when adding */
  event: PersonalEvent | null;
  defaults: {
    date?: string;
    /** Google-style «Подробнее» from the quick-create popup — prefilled times */
    startMin?: number;
    endMin?: number;
    allDay?: boolean;
    /** extras already picked in the quick popup */
    color?: string | null;
    repeat?: RepeatKind;
  };
  t: Dict;
  /** UI language — used by the color palette tooltips */
  lang: Lang;
  /** resolves on success (dialog closes), rejects on failure (dialog stays open) */
  onSave: (draft: {
    date: string;
    title: string;
    startMin: number;
    endMin: number;
    allDay: boolean;
    note?: string;
    color: string | null;
    repeat: RepeatKind;
  }) => Promise<void>;
  /**
   * only rendered when editing an existing event. For recurring series the
   * dialog asks the scope first (Google-style) and forwards "this"/"series";
   * single events always arrive as "series" (the row itself).
   */
  onDelete?: (scope: "this" | "series") => Promise<void>;
}

const STEP = 15;
const REPEAT_OPTIONS = ["none", "daily", "weekly", "monthly"] as const;

/** 0:00..23:45 in 15-min steps */
function dayOptions(from: number, to: number): number[] {
  const out: number[] = [];
  const first = Math.ceil(from / STEP) * STEP;
  for (let m = first; m <= to; m += STEP) out.push(m);
  return out;
}

/** default start: current time rounded up to the next 15 min */
function defaultStart(): number {
  const now = new Date();
  return Math.min(Math.ceil((now.getHours() * 60 + now.getMinutes()) / STEP) * STEP, 22 * 60);
}

/**
 * Add / edit a PRIVATE calendar event («личный календарь»).
 * Unlike shifts: title is required, ANY time of day is allowed (no gym
 * working windows), all-day supported, and the owner is always the
 * logged-in trainer (no trainer picker).
 * Google-like extras: own color palette + simple recurrence with the
 * delete-scope question («только это событие» vs «вся серия»).
 */
export function PersonalEventDialog({
  open,
  onOpenChange,
  event,
  defaults,
  t,
  lang,
  onSave,
  onDelete,
}: PersonalEventDialogProps) {
  const [title, setTitle] = useState(event?.title ?? "");
  const [date, setDate] = useState(event?.date ?? defaults.date ?? dateKey(new Date()));
  const [allDay, setAllDay] = useState(event?.allDay ?? defaults.allDay ?? false);
  const [startMin, setStartMin] = useState(
    event?.startMin ?? defaults.startMin ?? defaultStart(),
  );
  const [endMin, setEndMin] = useState(
    event?.endMin ?? defaults.endMin ?? (defaults.startMin != null ? defaults.startMin + 60 : defaultStart() + 60),
  );
  const [note, setNote] = useState(event?.note ?? "");
  const [color, setColor] = useState<string | null>(event?.color ?? defaults.color ?? null);
  const [repeat, setRepeat] = useState<RepeatKind>(event?.repeat ?? defaults.repeat ?? "none");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  /** Google-style «this occurrence or the whole series?» chooser */
  const [scopeOpen, setScopeOpen] = useState(false);

  const recurring = !!event && !!event.repeat && event.repeat !== "none";

  const startOpts = useMemo(() => dayOptions(0, 1440 - STEP), []);
  const endOpts = useMemo(() => dayOptions(startMin + STEP, 1440), [startMin]);

  const repeatLabel = (r: RepeatKind): string =>
    r === "daily"
      ? t.personal.repeatDaily
      : r === "weekly"
        ? t.personal.repeatWeekly
        : r === "monthly"
          ? t.personal.repeatMonthly
          : t.personal.repeatNone;

  const valid = title.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date) && (allDay || endMin > startMin);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onSave({
        date,
        title: title.trim(),
        startMin,
        endMin,
        allDay,
        note: note.trim() ? note.trim() : undefined,
        color,
        repeat,
      });
      onOpenChange(false);
    } catch {
      /* server error toasts are handled by the mutation in page.tsx */
    } finally {
      setSaving(false);
    }
  };

  const remove = async (scope: "this" | "series") => {
    if (!onDelete || deleting) return;
    setDeleting(true);
    try {
      await onDelete(scope);
      setScopeOpen(false);
      onOpenChange(false);
    } catch {
      /* toast handled in page.tsx */
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="size-4 text-primary" aria-hidden="true" />
            {event ? t.personal.editTitle : t.personal.addTitle}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-4 py-1" noValidate>
          <div className="grid gap-2">
            <Label htmlFor="pe-title">{t.personal.titleLabel}</Label>
            <Input
              id="pe-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.personal.titlePh}
              maxLength={80}
              autoFocus
              className="min-h-11"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="pe-date">{t.fields.date}</Label>
            <Input
              id="pe-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="min-h-11 [direction:ltr]"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-3 py-2.5">
            <Label htmlFor="pe-allday" className="cursor-pointer text-sm font-medium">
              {t.personal.allDay}
            </Label>
            <Switch id="pe-allday" checked={allDay} onCheckedChange={setAllDay} />
          </div>

          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="pe-start">{t.fields.start}</Label>
                <Select
                  value={String(startMin)}
                  onValueChange={(v) => {
                    const m = Number(v);
                    setStartMin(m);
                    if (endMin <= m) setEndMin(Math.min(m + 60, 1440));
                  }}
                >
                  <SelectTrigger id="pe-start" className="min-h-11 w-full" dir="ltr">
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
                <Label htmlFor="pe-end">{t.fields.end}</Label>
                <Select value={String(endMin)} onValueChange={(v) => setEndMin(Number(v))}>
                  <SelectTrigger id="pe-end" className="min-h-11 w-full" dir="ltr">
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
          )}

          {/* Google-like recurrence */}
          <div className="grid gap-2">
            <Label htmlFor="pe-repeat" className="flex items-center gap-1.5">
              <Repeat className="size-3.5 text-muted-foreground" aria-hidden="true" />
              {t.personal.repeat}
            </Label>
            <Select value={repeat} onValueChange={(v) => setRepeat(v as RepeatKind)}>
              <SelectTrigger id="pe-repeat" className="min-h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPEAT_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {repeatLabel(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {recurring && (
              <p className="text-[0.6875rem] leading-snug text-muted-foreground">
                {t.personal.seriesHint}
              </p>
            )}
          </div>

          {/* Google-like event color */}
          <div className="grid gap-2">
            <Label>{t.personal.color}</Label>
            <EventColorPicker value={color} onChange={setColor} lang={lang} t={t} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="pe-note">{t.fields.note}</Label>
            <Input
              id="pe-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.fields.notePh}
              maxLength={80}
              className="min-h-11"
            />
          </div>

          <p className="flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
            <Lock className="size-3 shrink-0" aria-hidden="true" />
            {t.personal.privateHint}
          </p>

          <DialogFooter className="gap-2">
            {onDelete && (
              <Button
                type="button"
                variant="outline"
                className="me-auto border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  if (recurring) setScopeOpen(true);
                  else void remove("series");
                }}
                disabled={saving || deleting}
              >
                {deleting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" />}
                {t.btn.delete}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.btn.cancel}
            </Button>
            <Button type="submit" disabled={!valid || saving}>
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {t.btn.save}
            </Button>
          </DialogFooter>
        </form>

        {/* this occurrence vs the whole series (only for recurring events) */}
        <AlertDialog open={scopeOpen} onOpenChange={setScopeOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.personal.delScopeTitle}</AlertDialogTitle>
              <AlertDialogDescription>{t.personal.delScopeDesc}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
              <AlertDialogCancel disabled={deleting}>{t.btn.cancel}</AlertDialogCancel>
              <Button
                type="button"
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={deleting}
                onClick={() => void remove("this")}
              >
                {deleting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {t.personal.delThisOnly}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deleting}
                onClick={() => void remove("series")}
              >
                {t.personal.delAllEvents}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
