"use client";

import {
  Bell,
  BellOff,
  CalendarCheck,
  CalendarClock,
  Copy,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
  UserMinus,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { TrainerAvatar } from "./trainer-avatar";
import { buildChangeMessage, relTime } from "@/lib/format";
import { toast } from "sonner";
import type { Dict } from "@/lib/i18n";
import type { ChangeAction, ChangeEntry, Lang, Trainer } from "@/lib/types";

interface ActivityPanelProps {
  entries: ChangeEntry[];
  trainers: Trainer[];
  me: Trainer | null;
  lang: Lang;
  t: Dict;
  loading?: boolean;
  /** close handler — only used by the mobile drawer */
  onClose?: () => void;
  asSheet?: boolean;
  sheetOpen?: boolean;
  onSheetOpenChange?: (open: boolean) => void;
  /** desktop aside visibility (bell toggle) */
  open?: boolean;
}

const ACTION_STYLE: Record<ChangeAction, { bg: string; fg: string; icon: LucideIcon }> = {
  shift_add: { bg: "rgba(16,185,129,0.15)", fg: "#10b981", icon: Plus },
  shift_edit: { bg: "rgba(245,158,11,0.16)", fg: "#f59e0b", icon: Pencil },
  shift_delete: { bg: "rgba(244,63,94,0.14)", fg: "#f43f5e", icon: Trash2 },
  template_save: { bg: "rgba(13,148,136,0.14)", fg: "#0d9488", icon: CalendarClock },
  template_apply: { bg: "rgba(13,148,136,0.14)", fg: "#0d9488", icon: CalendarCheck },
  trainer_join: { bg: "rgba(16,185,129,0.15)", fg: "#10b981", icon: UserPlus },
  trainer_add: { bg: "rgba(13,148,136,0.16)", fg: "#0d9488", icon: UserPlus },
  trainer_remove: { bg: "rgba(244,63,94,0.14)", fg: "#f43f5e", icon: UserMinus },
};

function ActionBadge({ action, t }: { action: ChangeAction; t: Dict }) {
  const s = ACTION_STYLE[action];
  const Icon = s.icon;
  return (
    <span
      className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.625rem] font-semibold"
      style={{ background: s.bg, color: s.fg }}
    >
      <Icon className="size-3" aria-hidden="true" />
      {t.changes.badges[action]}
    </span>
  );
}

/** WhatsApp deep-link helpers (phone stored digits-only) */
function waLink(phone: string, msg: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`;
}

function SharePopover({ entry, trainers, lang, t }: {
  entry: ChangeEntry;
  trainers: Trainer[];
  lang: Lang;
  t: Dict;
}) {
  const msg = buildChangeMessage(entry, lang);
  const withPhone = trainers.filter((tr) => tr.phone && tr.phone.replace(/\D/g, "").length >= 5);

  const copyMsg = async () => {
    try {
      await navigator.clipboard.writeText(msg);
      toast.success(t.whatsapp.copiedMsg);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 rounded-md"
          aria-label={t.whatsapp.share}
        >
          <MessageCircle className="size-3.5 text-emerald-600" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <p className="text-xs font-semibold">{t.whatsapp.share}</p>
        <p className="mt-1 rounded-md bg-secondary/70 px-2 py-1.5 text-[0.6875rem] leading-relaxed">
          {msg}
        </p>
        <div className="mt-2 max-h-44 overflow-y-auto scroll-slim">
          {withPhone.length === 0 ? (
            <p className="px-1 py-1.5 text-[0.6875rem] text-muted-foreground">{t.whatsapp.noPhone}</p>
          ) : (
            <ul className="space-y-0.5">
              {withPhone.map((tr) => (
                <li key={tr.id}>
                  <a
                    href={waLink(tr.phone ?? "", msg)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-9 items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-accent"
                  >
                    <TrainerAvatar name={tr.name} color={tr.color} size={24} />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">{tr.name}</span>
                    <span dir="ltr" className="shrink-0 text-[0.625rem] tabular-nums text-muted-foreground">
                      {tr.phone}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Separator className="my-2" />
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" className="h-8 flex-1 gap-1.5 text-xs" asChild>
            <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer">
              <MessageCircle className="size-3.5" aria-hidden="true" />
              {t.whatsapp.otherChat}
            </a>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8 shrink-0"
            onClick={copyMsg}
            aria-label={t.whatsapp.copyMsg}
          >
            <Copy className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-4 px-4 py-4" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="size-[30px] shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-2.5 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityList({
  entries,
  trainers,
  me,
  lang,
  t,
  loading,
}: Pick<ActivityPanelProps, "entries" | "trainers" | "me" | "lang" | "t" | "loading">) {
  const colorById = new Map(trainers.map((tr) => [tr.id, tr.color]));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto scroll-slim">
        {loading ? (
          <ListSkeleton />
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <BellOff className="size-6 text-muted-foreground/60" aria-hidden="true" />
            <p className="text-xs text-muted-foreground">{t.activityEmpty}</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {entries.map((e) => (
              <li key={e.id} className="flex gap-3 px-4 py-3">
                <TrainerAvatar
                  name={e.actorName}
                  color={colorById.get(e.actorId) ?? "#94a3b8"}
                  size={30}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="truncate text-sm font-semibold">{e.actorName}</span>
                    <ActionBadge action={e.action} t={t} />
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-foreground/90">
                    {buildChangeMessage(e, lang).replace(/^🏋️ GymShift: /, "")}
                  </p>
                  <p className="mt-0.5 text-[0.6875rem] text-muted-foreground/70">
                    {relTime(new Date(e.createdAt).getTime(), lang, t.justNow)}
                  </p>
                </div>
                <SharePopover entry={e} trainers={trainers} lang={lang} t={t} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {me && (
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2.5 rounded-xl bg-secondary/70 px-3 py-2">
            <TrainerAvatar name={me.name} color={me.color} size={30} />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{me.name}</p>
              <p className="text-[0.6875rem] text-muted-foreground">{t.loggedInAs}</p>
            </div>
            <Badge variant="secondary" className="ms-auto shrink-0 text-[0.625rem]">
              {t.roles[me.role]}
            </Badge>
          </div>
        </div>
      )}
    </div>
  );
}

function PanelHeader({ t, count, onClose }: { t: Dict; count: number; onClose?: () => void }) {
  return (
    <div className="flex items-center gap-2 border-b border-border px-4 py-3">
      <Bell className="size-4 text-muted-foreground" aria-hidden="true" />
      <h2 className="flex-1 text-sm font-semibold">{t.activity}</h2>
      {count > 0 && (
        <Badge variant="secondary" className="tabular-nums">
          {count}
        </Badge>
      )}
      {onClose && (
        <Button variant="ghost" size="icon" className="size-9" onClick={onClose} aria-label={t.btn.close}>
          <X className="size-5" />
        </Button>
      )}
    </div>
  );
}

/** Activity feed: fixed aside on desktop, slide-in sheet on mobile */
export function ActivityPanel({
  entries,
  trainers,
  me,
  lang,
  t,
  loading,
  onClose,
  asSheet,
  sheetOpen,
  onSheetOpenChange,
  open,
}: ActivityPanelProps) {
  if (asSheet) {
    return (
      <Sheet open={sheetOpen} onOpenChange={onSheetOpenChange}>
        <SheetContent
          side={lang === "he" ? "left" : "right"}
          className="flex w-[86%] max-w-sm flex-col gap-0 p-0 [&>button[data-slot=sheet-close]]:hidden"
        >
          <SheetHeader className="border-b border-border p-0">
            <SheetTitle className="sr-only">{t.activity}</SheetTitle>
          </SheetHeader>
          <PanelHeader t={t} count={entries.length} onClose={onClose} />
          <ActivityList entries={entries} trainers={trainers} me={me} lang={lang} t={t} loading={loading} />
        </SheetContent>
      </Sheet>
    );
  }

  if (!open) return null;

  return (
    <aside className="hidden w-[320px] shrink-0 flex-col border-s border-border bg-card/40 xl:flex 2xl:w-[350px]">
      <PanelHeader t={t} count={entries.length} />
      <ActivityList entries={entries} trainers={trainers} me={me} lang={lang} t={t} loading={loading} />
    </aside>
  );
}
