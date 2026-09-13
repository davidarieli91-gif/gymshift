"use client";

import { useState } from "react";
import { Bell, CalendarClock, Dumbbell, Users, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeMenu } from "./theme-menu";
import { FontSizeControl } from "./font-size-control";
import { InviteDialog } from "./invite-dialog";
import { TrainersDialog } from "./trainers-dialog";
import { UserMenu } from "./user-menu";
import { type Dict } from "@/lib/i18n";
import type { Lang, Trainer } from "@/lib/types";

interface HeaderBarProps {
  lang: Lang;
  onLangChange: (l: Lang) => void;
  themeId: string;
  onThemeChange: (id: string) => void;
  activityOpen: boolean;
  onToggleActivity: () => void;
  unread: number;
  user: Trainer | null;
  /** all trainers — for the «Все тренера» dialog */
  trainers: Trainer[];
  isAdmin: boolean;
  /** admin add/remove trainer handlers (mutated in page.tsx) */
  addingTrainer: boolean;
  deletingTrainerId: string | null;
  onAddTrainer: (body: { name: string; pin: string; phone?: string }) => Promise<Trainer>;
  onDeleteTrainer: (trainer: Trainer) => Promise<void>;
  connected: boolean;
  /** system font scale (0.8..1.4) — header «−/+» buttons */
  fontScale: number;
  onFontStep: (dir: 1 | -1) => void;
  onFontReset: () => void;
  onOpenTemplate: () => void;
  canInstall: boolean;
  onInstall: () => void;
  onLogout: () => void;
  savingProfile: boolean;
  onUpdateProfile: (patch: { phone?: string; pin?: string }) => Promise<void>;
  t: Dict;
}

/**
 * Sticky top bar. Desktop (sm+): logo · template · all-trainers · language ·
 * theme · invite · activity feed · user menu. Mobile: logo · language · theme ·
 * activity feed · user menu — everything else lives in the user menu so the
 * bar always fits a 360 px screen.
 */
export function HeaderBar({
  lang,
  onLangChange,
  themeId,
  onThemeChange,
  activityOpen,
  onToggleActivity,
  unread,
  user,
  trainers,
  isAdmin,
  addingTrainer,
  deletingTrainerId,
  onAddTrainer,
  onDeleteTrainer,
  connected,
  fontScale,
  onFontStep,
  onFontReset,
  onOpenTemplate,
  canInstall,
  onInstall,
  onLogout,
  savingProfile,
  onUpdateProfile,
  t,
}: HeaderBarProps) {
  const connLabel = connected ? t.connection.online : t.connection.offline;
  const [trainersOpen, setTrainersOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg-header/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center gap-1 sm:gap-2 sm:px-4">
        {/* logo + live connection dot */}
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Dumbbell className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="flex items-center gap-1.5 text-sm font-bold tracking-tight">
              GymShift
              <span
                role="status"
                aria-label={connLabel}
                title={connLabel}
                className={`size-2 shrink-0 rounded-full transition-colors ${
                  connected ? "bg-emerald-500" : "bg-muted-foreground/40"
                }`}
              />
            </p>
            <p className="hidden truncate text-[0.6875rem] text-muted-foreground sm:block">{t.subtitle}</p>
          </div>
        </div>

        <div className="flex-1" />

        {/* weekly standard-shifts template — desktop only (in the user menu on mobile) */}
        <Button
          variant="outline"
          size="sm"
          className="hidden h-9 gap-1.5 rounded-lg px-2.5 sm:inline-flex"
          onClick={onOpenTemplate}
          aria-label={t.templateTrigger}
        >
          <CalendarClock className="size-4" aria-hidden="true" />
          <span className="hidden md:inline">{t.templateTrigger}</span>
        </Button>

        {/* «Все тренера» — team list with contacts — desktop only (in the user menu on mobile) */}
        <Button
          variant="outline"
          size="sm"
          className="hidden h-9 gap-1.5 rounded-lg px-2.5 sm:inline-flex"
          onClick={() => setTrainersOpen(true)}
          aria-label={t.trainersDialog.title}
        >
          <Users className="size-4" aria-hidden="true" />
          <span className="hidden lg:inline">{t.trainersDialog.title}</span>
        </Button>

        {/* language: ONE button — shows the language you can switch to */}
        <button
          type="button"
          aria-label={t.switchLang}
          title={t.switchLang}
          onClick={() => onLangChange(lang === "ru" ? "he" : "ru")}
          className="flex h-9 min-w-[40px] items-center justify-center rounded-lg border border-border bg-card px-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:min-w-[44px] sm:px-2.5"
        >
          {lang === "ru" ? "עב" : "РУС"}
        </button>

        {/* theme: one-click dropdown with 10 themes */}
        <ThemeMenu themeId={themeId} onThemeChange={onThemeChange} lang={lang} t={t} />

        {/* system font size: inline «− 100% +» on desktop, «Aa» popover on mobile */}
        <FontSizeControl scale={fontScale} onStep={onFontStep} onReset={onFontReset} t={t} />

        {/* invite a trainer via link — desktop only (in the user menu on mobile) */}
        <Button
          size="sm"
          className="hidden h-9 gap-1.5 rounded-lg px-2.5 sm:inline-flex"
          onClick={() => setInviteOpen(true)}
          aria-label={t.invite}
        >
          <UserPlus className="size-4" aria-hidden="true" />
          <span className="hidden md:inline">{t.invite}</span>
        </Button>

        {/* activity feed toggle */}
        <Button
          variant="outline"
          size="icon"
          className="relative size-9 shrink-0 rounded-lg"
          onClick={onToggleActivity}
          aria-label={t.activity}
          aria-pressed={activityOpen}
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -end-1 -top-1 flex max-w-6 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 text-[0.625rem] font-bold leading-none text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>

        {/* user menu (mobile: + template / trainers / invite / profile / install / logout) */}
        {user && (
          <UserMenu
            user={user}
            t={t}
            canInstall={canInstall}
            onInstall={onInstall}
            onLogout={onLogout}
            savingProfile={savingProfile}
            onUpdateProfile={onUpdateProfile}
            onOpenTemplate={onOpenTemplate}
            onOpenTrainers={() => setTrainersOpen(true)}
            onOpenInvite={() => setInviteOpen(true)}
          />
        )}
      </div>

      {/* dialogs triggered from this bar */}
      <TrainersDialog
        open={trainersOpen}
        onOpenChange={setTrainersOpen}
        trainers={trainers}
        me={user}
        isAdmin={isAdmin}
        adding={addingTrainer}
        deletingId={deletingTrainerId}
        onAddTrainer={onAddTrainer}
        onDeleteTrainer={onDeleteTrainer}
        t={t}
      />
      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} t={t} />
    </header>
  );
}
