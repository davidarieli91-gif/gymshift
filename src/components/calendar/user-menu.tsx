"use client";

import { useState } from "react";
import { CalendarClock, ChevronsUpDown, Download, Loader2, LogOut, UserRoundPen, UserPlus, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrainerAvatar } from "./trainer-avatar";
import type { Dict } from "@/lib/i18n";
import type { Trainer } from "@/lib/types";

interface UserMenuProps {
  user: Trainer;
  t: Dict;
  canInstall: boolean;
  onInstall: () => void;
  onLogout: () => void;
  savingProfile: boolean;
  onUpdateProfile: (patch: { phone?: string; pin?: string }) => Promise<void>;
  /** mobile only (sm:hidden): open the standard-shifts template */
  onOpenTemplate?: () => void;
  /** mobile only (sm:hidden): open the «Все тренера» dialog */
  onOpenTrainers?: () => void;
  /** mobile only (sm:hidden): open the invite dialog */
  onOpenInvite?: () => void;
}

/** Avatar dropdown: role badge, profile dialog, PWA install, logout.
 *  On narrow screens it also carries the header actions that don't fit:
 *  template / all-trainers / invite (hidden on sm+ via CSS). */
export function UserMenu({
  user,
  t,
  canInstall,
  onInstall,
  onLogout,
  savingProfile,
  onUpdateProfile,
  onOpenTemplate,
  onOpenTrainers,
  onOpenInvite,
}: UserMenuProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const hasExtras = !!(onOpenTemplate || onOpenTrainers || onOpenInvite);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-lg ps-0 pe-0"
            aria-label={user.name}
          >
            <span className="flex items-center gap-0.5">
              <TrainerAvatar name={user.name} color={user.color} size={28} />
              <ChevronsUpDown className="hidden size-3 text-muted-foreground sm:block" aria-hidden="true" />
            </span>
          </Button>
        </DropdownMenuTrigger>
        {/* onCloseAutoFocus: without it Radix returns focus to the trigger right
            after a menu item opens a dialog — that focus jump lands outside the
            fresh dialog and instantly dismisses it (menu → dialog race). */}
        <DropdownMenuContent
          align="end"
          className="w-56"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DropdownMenuLabel className="flex flex-col gap-1">
            <span className="truncate text-sm font-semibold">{user.name}</span>
            <Badge variant="secondary" className="w-fit text-[0.625rem]">
              {t.roles[user.role]}
            </Badge>
          </DropdownMenuLabel>
          {hasExtras && (
            <>
              <DropdownMenuSeparator className="sm:hidden" />
              {onOpenTemplate && (
                <DropdownMenuItem className="sm:hidden" onSelect={() => onOpenTemplate()}>
                  <CalendarClock className="size-4" aria-hidden="true" />
                  {t.templateTrigger}
                </DropdownMenuItem>
              )}
              {onOpenTrainers && (
                <DropdownMenuItem className="sm:hidden" onSelect={() => onOpenTrainers()}>
                  <Users className="size-4" aria-hidden="true" />
                  {t.trainersDialog.title}
                </DropdownMenuItem>
              )}
              {onOpenInvite && (
                <DropdownMenuItem className="sm:hidden" onSelect={() => onOpenInvite()}>
                  <UserPlus className="size-4" aria-hidden="true" />
                  {t.invite}
                </DropdownMenuItem>
              )}
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setProfileOpen(true)}>
            <UserRoundPen className="size-4" aria-hidden="true" />
            {t.userMenu.profile}
          </DropdownMenuItem>
          {canInstall && (
            <DropdownMenuItem onSelect={() => onInstall()}>
              <Download className="size-4" aria-hidden="true" />
              {t.userMenu.install}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => onLogout()}>
            <LogOut className="size-4" aria-hidden="true" />
            {t.userMenu.logout}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        user={user}
        t={t}
        saving={savingProfile}
        onSave={onUpdateProfile}
      />
    </>
  );
}

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: Trainer;
  t: Dict;
  saving: boolean;
  onSave: (patch: { phone?: string; pin?: string }) => Promise<void>;
}

const PIN_RE = /^\d{4,8}$/;

/** «Мой профиль»: phone (WhatsApp) + optional PIN change → PATCH /api/trainers/:id */
function ProfileDialog({ open, onOpenChange, user, t, saving, onSave }: ProfileDialogProps) {
  const [phone, setPhone] = useState(user.phone ?? "");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedPhone = phone.trim();
    const trimmedPin = pin.trim();
    if (trimmedPin && !PIN_RE.test(trimmedPin)) {
      setError(t.auth.errPin);
      return;
    }
    setError(null);
    const patch: { phone?: string; pin?: string } = { phone: trimmedPhone };
    if (trimmedPin) patch.pin = trimmedPin;
    try {
      await onSave(patch);
      setPin("");
      onOpenChange(false);
    } catch {
      /* error toast is shown by the mutation in page.tsx */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t.profile.title}</DialogTitle>
          <DialogDescription>{t.profile.desc}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-4" noValidate>
          <div className="flex items-center gap-2.5 rounded-xl bg-secondary/60 px-3 py-2">
            <TrainerAvatar name={user.name} color={user.color} size={34} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="text-[0.6875rem] text-muted-foreground">{t.roles[user.role]}</p>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="profile-phone">{t.profile.phone}</Label>
            <Input
              id="profile-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t.auth.phonePh}
              dir="ltr"
              className="min-h-11"
            />
            <p className="text-[0.6875rem] text-muted-foreground">{t.profile.phoneHint}</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="profile-pin">{t.profile.newPin}</Label>
            <Input
              id="profile-pin"
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder={t.auth.pinPh}
              dir="ltr"
              className="min-h-11"
            />
            <p className="text-[0.6875rem] text-muted-foreground">{t.profile.newPinHint}</p>
          </div>

          {error && (
            <p role="alert" className="text-xs font-medium text-destructive">
              {error}
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.btn.cancel}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {t.profile.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
