"use client";

import { useState } from "react";
import { Dices, Loader2, MessageCircle, Phone, Trash2, UserPlus, Users } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrainerAvatar } from "./trainer-avatar";
import { fmtPhone, intlPhone } from "@/lib/format";
import type { Dict } from "@/lib/i18n";
import type { Trainer } from "@/lib/types";

interface TrainersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** all trainers in the system (already loaded by the app) */
  trainers: Trainer[];
  /** currently logged-in trainer (gets a "вы" badge) */
  me: Trainer | null;
  isAdmin: boolean;
  /** admin mutations — wired to page.tsx (toasts + cache invalidation live there) */
  adding: boolean;
  deletingId: string | null;
  onAddTrainer: (body: { name: string; pin: string; phone?: string }) => Promise<Trainer>;
  onDeleteTrainer: (trainer: Trainer) => Promise<void>;
  t: Dict;
}

/** Split "Имя Фамилия" -> {first, last}; safe for single-word names */
function splitName(full: string): { first: string; last: string | null } {
  const idx = full.indexOf(" ");
  if (idx === -1) return { first: full, last: null };
  return { first: full.slice(0, idx), last: full.slice(idx + 1) };
}

const randomPin = () => String(Math.floor(1000 + Math.random() * 9000));

/**
 * «Все тренера» — the whole team with contacts: first/last name, role,
 * phone with WhatsApp + call shortcuts.
 * Admin extras: add a trainer (name + PIN + phone) and remove trainers
 * (with a clear warning about the shifts/template cascade).
 */
export function TrainersDialog({
  open,
  onOpenChange,
  trainers,
  me,
  isAdmin,
  adding,
  deletingId,
  onAddTrainer,
  onDeleteTrainer,
  t,
}: TrainersDialogProps) {
  const d = t.trainersDialog;
  const [addOpen, setAddOpen] = useState(false);
  const [target, setTarget] = useState<Trainer | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-5 text-primary" aria-hidden="true" />
            {d.title}
          </DialogTitle>
          <DialogDescription>{d.count(trainers.length)}</DialogDescription>
        </DialogHeader>

        {isAdmin && (
          <Button
            variant="outline"
            className="h-10 w-full gap-2 rounded-lg border-dashed text-sm font-medium"
            onClick={() => setAddOpen(true)}
          >
            <UserPlus className="size-4 text-primary" aria-hidden="true" />
            {d.add}
          </Button>
        )}

        {trainers.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t.activityEmpty}</p>
        ) : (
          <ul className="grid max-h-[55vh] gap-2 overflow-y-auto scroll-slim pe-0.5">
            {trainers.map((tr) => {
              const { first, last } = splitName(tr.name);
              const intl = tr.phone ? intlPhone(tr.phone) : null;
              const isMe = me?.id === tr.id;
              const canDelete = isAdmin && !isMe;
              return (
                <li
                  key={tr.id}
                  className="rounded-xl border border-border bg-card p-3"
                >
                  <div className="flex items-center gap-3">
                    <TrainerAvatar name={tr.name} color={tr.color} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-baseline gap-x-1.5 text-sm leading-tight">
                        <span className="font-semibold">{first}</span>
                        {last && <span className="truncate text-muted-foreground">{last}</span>}
                        {isMe && (
                          <Badge variant="secondary" className="px-1.5 py-0 text-[0.625rem]">
                            {t.you}
                          </Badge>
                        )}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span>{t.roles[tr.role] ?? tr.role}</span>
                        {tr.phone ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span dir="ltr" className="tabular-nums">
                              {fmtPhone(tr.phone)}
                            </span>
                          </>
                        ) : (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{d.noPhone}</span>
                          </>
                        )}
                      </p>
                    </div>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => setTarget(tr)}
                        disabled={deletingId !== null}
                        aria-label={`${t.btn.delete} ${first}`}
                        title={t.btn.delete}
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
                      >
                        {deletingId === tr.id ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Trash2 className="size-4" aria-hidden="true" />
                        )}
                      </button>
                    )}
                  </div>

                  {intl && (
                    <div className="mt-2.5 flex gap-2">
                      <Button variant="outline" size="sm" className="h-8 flex-1 gap-1.5 text-xs" asChild>
                        <a
                          href={`https://wa.me/${intl}`}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`${d.write} ${first}`}
                        >
                          <MessageCircle className="size-3.5 text-emerald-600" aria-hidden="true" />
                          {d.write}
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 w-11 gap-1.5" asChild>
                        <a href={`tel:+${intl}`} aria-label={`${d.call} ${first}`}>
                          <Phone className="size-3.5" aria-hidden="true" />
                        </a>
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>

      {/* admin: add a trainer (name + phone + PIN, no self-registration needed).
          key remounts the form on every open so it starts fresh. */}
      <AddTrainerDialog
        key={`add-${addOpen}`}
        open={addOpen}
        onOpenChange={(o) => setAddOpen(o)}
        adding={adding}
        onAdd={onAddTrainer}
        onAdded={() => setAddOpen(false)}
        t={t}
      />

      {/* admin: remove a trainer — confirm with cascade counts */}
      <AlertDialog open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{d.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {target &&
                d.deleteWarn(
                  target.name,
                  target.shiftsCount ?? 0,
                  target.templateCount ?? 0,
                  target.personalCount ?? 0,
                )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.btn.cancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingId !== null}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault(); // keep the dialog open while the request runs
                if (target) void onDeleteTrainer(target).then(() => setTarget(null));
              }}
            >
              {deletingId !== null && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {d.deleteConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

interface AddTrainerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adding: boolean;
  onAdd: (body: { name: string; pin: string; phone?: string }) => Promise<Trainer>;
  onAdded: () => void;
  t: Dict;
}

/** Admin-only form: name + optional phone + PIN (pre-filled random, regenerable). */
function AddTrainerDialog({ open, onOpenChange, adding, onAdd, onAdded, t }: AddTrainerDialogProps) {
  const d = t.trainersDialog;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState(randomPin);
  const [localErr, setLocalErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setLocalErr(t.auth.errName);
      return;
    }
    if (!/^\d{4,8}$/.test(pin)) {
      setLocalErr(t.auth.errPin);
      return;
    }
    setLocalErr(null);
    try {
      await onAdd({ name: name.trim(), pin, phone: phone.trim() || undefined });
      onAdded();
    } catch {
      /* error toast is shown by the mutation in page.tsx */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{d.addTitle}</DialogTitle>
          <DialogDescription className="text-xs">{d.addDesc}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-3" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="add-tr-name">{t.auth.name}</Label>
            <Input
              id="add-tr-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.auth.namePh}
              autoComplete="off"
              className="min-h-11"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="add-tr-phone">
              {t.auth.phone} <span className="text-xs text-muted-foreground">({t.auth.phoneOptional})</span>
            </Label>
            <Input
              id="add-tr-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t.auth.phonePh}
              dir="ltr"
              inputMode="tel"
              autoComplete="off"
              className="min-h-11"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="add-tr-pin">{t.auth.pin}</Label>
            <div className="flex gap-2">
              <Input
                id="add-tr-pin"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                inputMode="numeric"
                dir="ltr"
                autoComplete="off"
                className="min-h-11 flex-1 tabular-nums"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 shrink-0 rounded-lg"
                onClick={() => setPin(randomPin())}
                aria-label={d.generate}
                title={d.generate}
              >
                <Dices className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <p className="text-[0.6875rem] text-muted-foreground">{d.pinHint}</p>
          </div>

          {localErr && <p className="text-xs font-medium text-destructive">{localErr}</p>}

          <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={adding}>
              {t.btn.cancel}
            </Button>
            <Button type="submit" disabled={adding}>
              {adding && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {d.create}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
