"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dumbbell, RotateCw } from "lucide-react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HeaderBar } from "@/components/calendar/header-bar";
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar";
import { MultiDayGrid, type GridDragSpec, type PersonalMoveSpec, type ShiftMoveSpec } from "@/components/calendar/multi-day-grid";
import { MonthGrid } from "@/components/calendar/month-grid";
import { ShiftDialog } from "@/components/calendar/shift-dialog";
import { PersonalEventDialog } from "@/components/calendar/personal-event-dialog";
import { PersonalQuickCreate, type PersonalQuickSpec } from "@/components/calendar/personal-quick-create";
import { ActivityPanel } from "@/components/calendar/activity-panel";
import { TemplateDialog } from "@/components/calendar/template-dialog";
import { AuthScreen } from "@/components/auth/auth-screen";
import { dict, type Dict } from "@/lib/i18n";
import { resolveTheme } from "@/lib/themes";
import { DAY_WINDOWS } from "@/lib/constants";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import {
  addDays,
  addMonths,
  dateFromKey,
  dateKey,
  fmtDayFull,
  fmtMonthYear,
  fmtRangeShort,
  monthCells,
  startOfDay,
  startOfWeek,
} from "@/lib/format";
import type { CalendarMode, Lang, PersonalEvent, RepeatKind, Shift, TemplateSlotInput, Trainer, ViewId } from "@/lib/types";

const DESKTOP_MQ = "(min-width: 1280px)";
const NARROW_MQ = "(max-width: 639px)";
const OFFLINE_POLL_MS = 15_000;

/** root font scale bounds for the header «−/+» control */
const FONT_MIN = 0.8;
const FONT_MAX = 1.4;
const FONT_STEP = 0.1;

function clampFont(v: number): number {
  return Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(v * 100) / 100));
}

/** Client prefs read synchronously before first render (SSR-safe: defaults on server).
 *  Safe for hydration: while `ready` is false the page renders the same splash everywhere. */
interface Prefs {
  lang: Lang;
  themeId: string;
  view: ViewId;
  isDesktop: boolean;
  isNarrow: boolean;
  lastSeen: number;
  fontScale: number;
  mode: CalendarMode;
}

let prefsCache: Prefs | null = null;
function getPrefs(): Prefs {
  if (prefsCache) return prefsCache;
  if (typeof window === "undefined") {
    prefsCache = {
      lang: "ru",
      themeId: "auto",
      view: "week",
      isDesktop: true,
      isNarrow: false,
      lastSeen: 0,
      fontScale: 1,
      mode: "team",
    };
    return prefsCache;
  }
  const savedLang = localStorage.getItem("gs-lang");
  const rawSeen = localStorage.getItem("gs-lastSeen");
  if (!rawSeen) {
    // first visit — don't drown the user in old changes
    localStorage.setItem("gs-lastSeen", String(Date.now()));
  }
  prefsCache = {
    lang: savedLang === "he" ? "he" : "ru",
    themeId: localStorage.getItem("gs-theme") ?? "auto",
    view: window.innerWidth < 640 ? "day" : "week",
    isDesktop: window.matchMedia(DESKTOP_MQ).matches,
    isNarrow: window.matchMedia(NARROW_MQ).matches,
    lastSeen: rawSeen && Number.isFinite(Number(rawSeen)) ? Number(rawSeen) : 0,
    fontScale: clampFont(Number(localStorage.getItem("gs-font-scale")) || 1),
    mode: localStorage.getItem("gs-cal-mode") === "personal" ? "personal" : "team",
  };
  return prefsCache;
}

function BootSplash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
      <div className="flex size-12 animate-pulse items-center justify-center rounded-2xl bg-primary text-primary-foreground">
        <Dumbbell className="size-6" aria-hidden="true" />
      </div>
      <p className="text-sm text-muted-foreground">GymShift</p>
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm" aria-hidden="true">
      <div className="h-7 w-40 rounded-md bg-muted" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-10 w-14 shrink-0 rounded-md bg-muted" />
            <div className={`h-10 flex-1 rounded-lg bg-muted ${i % 2 ? "w-2/3" : ""}`} />
            <div className="h-10 w-1/4 rounded-lg bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Inline load-error card with a retry button (calendar area) */
function LoadError({ message, onRetry, t }: { message: string; onRetry: () => void; t: Dict }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
      <p className="text-sm font-semibold">{t.errorTitle}</p>
      <p className="mt-1 text-xs text-muted-foreground">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mx-auto mt-3 flex min-h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-accent"
      >
        <RotateCw className="size-4" aria-hidden="true" />
        {t.retry}
      </button>
    </div>
  );
}

export default function Home() {
  const qc = useQueryClient();
  const { token, ready, signIn, signOut, hydrate } = useAuth();
  const { canInstall, promptInstall } = useInstallPrompt();

  /* ---------- preferences (restored synchronously, before first paint) ---------- */
  const [lang, setLang] = useState<Lang>(() => getPrefs().lang);
  const [themeId, setThemeId] = useState<string>(() => getPrefs().themeId);
  const [view, setView] = useState<ViewId>(() => getPrefs().view);
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [dialogDefaults, setDialogDefaults] = useState<{
    date?: string;
    trainerId?: string;
    /** prefill from a grid drag-create (team calendar) */
    startMin?: number;
    endMin?: number;
  }>({});
  const [personalOpen, setPersonalOpen] = useState(false);
  const [editingPersonal, setEditingPersonal] = useState<PersonalEvent | null>(null);
  const [personalDefaults, setPersonalDefaults] = useState<{
    date?: string;
    startMin?: number;
    endMin?: number;
    allDay?: boolean;
    /** extras picked in the quick popup before «Подробнее» */
    color?: string | null;
    repeat?: RepeatKind;
  }>({});
  /** Google-style drag-to-create seed — the quick-create popup renders while set */
  const [quickDraft, setQuickDraft] = useState<PersonalQuickSpec | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(() => getPrefs().isDesktop);
  const [isDesktop, setIsDesktop] = useState(() => getPrefs().isDesktop);
  /** smartphone width — drives the compact week grid */
  const [isNarrow, setIsNarrow] = useState(() => getPrefs().isNarrow);
  /** epoch ms of the last time the changes panel was opened */
  const [lastSeen, setLastSeen] = useState(() => getPrefs().lastSeen);
  /** root font scale (header «−/+» buttons), persisted */
  const [fontScale, setFontScale] = useState(() => getPrefs().fontScale);
  /** team shifts vs the trainer's private calendar */
  const [mode, setMode] = useState<CalendarMode>(() => getPrefs().mode);

  const t = dict[lang];

  /* auth store: read localStorage token once on the client */
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  /* keep isNarrow in sync with the viewport (compact week layout) */
  useEffect(() => {
    const mq = window.matchMedia(NARROW_MQ);
    const onChange = () => setIsNarrow(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  /* keep isDesktop in sync with the viewport — decides feed mode (aside vs sheet).
   * Without this a window narrowed below 1280px hid the aside but never showed
   * the sheet: the bell pressed, focus ring showed, and the feed was nowhere. */
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ);
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  /* ---------- theme / lang side effects (layout already applied them pre-paint) ---------- */
  useEffect(() => {
    document.documentElement.dataset.theme = resolveTheme(themeId, new Date().getHours());
    localStorage.setItem("gs-theme", themeId);
  }, [themeId]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
    localStorage.setItem("gs-lang", lang);
  }, [lang]);

  /* font scale: grows/shrinks the root font size — every rem-based text and
   * spacing in the UI follows (layout.tsx restores it before first paint) */
  useEffect(() => {
    document.documentElement.style.fontSize =
      fontScale === 1 ? "" : `${16 * fontScale}px`;
    localStorage.setItem("gs-font-scale", String(fontScale));
  }, [fontScale]);

  /* ---------- visible days / range / title ---------- */
  const viewDays = useMemo(() => {
    const a = startOfDay(anchor);
    if (view === "day") return [a];
    if (view === "3d") return [a, addDays(a, 1), addDays(a, 2)];
    if (view === "week") {
      const ws = startOfWeek(a);
      return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    }
    return [];
  }, [view, anchor]);

  const monthCellList = useMemo(() => (view === "month" ? monthCells(anchor) : []), [view, anchor]);

  const range = useMemo(() => {
    const list = view === "month" ? monthCellList : viewDays;
    if (list.length === 0) return null;
    return { from: dateKey(list[0]), to: dateKey(list[list.length - 1]) };
  }, [view, viewDays, monthCellList]);

  const visibleKeys = useMemo(() => {
    const list = view === "month" ? monthCellList : viewDays;
    return new Set(list.map(dateKey));
  }, [view, viewDays, monthCellList]);

  const title = useMemo(() => {
    if (view === "month") return fmtMonthYear(anchor, lang);
    if (view === "day") return fmtDayFull(anchor, lang);
    if (view === "3d") return fmtRangeShort(anchor, addDays(anchor, 2), lang);
    const ws = startOfWeek(anchor);
    return fmtRangeShort(ws, addDays(ws, 6), lang);
  }, [view, anchor, lang]);

  /* ---------- realtime socket (invalidates query caches) ---------- */
  const connected = useRealtime(!!token, {
    onShiftsChanged: () => qc.invalidateQueries({ queryKey: ["shifts"] }),
    onTemplateChanged: () => qc.invalidateQueries({ queryKey: ["template"] }),
    onTrainersChanged: () => {
      qc.invalidateQueries({ queryKey: ["trainers"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onChangesNew: () => qc.invalidateQueries({ queryKey: ["changes"] }),
  });

  /* ---------- auth gate ---------- */
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    enabled: ready && !!token,
    retry: false,
    staleTime: 60_000,
  });
  const meTrainer = meQuery.data?.trainer ?? null;
  const authed = !!token && meQuery.isSuccess && !!meTrainer;
  const user = meTrainer;
  const isAdmin = user?.role === "admin";

  /* stale token (server restarted / DB reset / PIN changed):
   * /api/auth/me answers {trainer: null} — drop the token silently
   * and return to the login screen instead of showing an error. */
  useEffect(() => {
    if (ready && token && meQuery.isSuccess && meQuery.data?.trainer === null) {
      qc.removeQueries({ queryKey: ["me"] });
      signOut();
    }
  }, [ready, token, meQuery.isSuccess, meQuery.data, qc, signOut]);

  /* ---------- data queries (poll while socket is offline) ---------- */
  const poll = connected ? false : OFFLINE_POLL_MS;

  const trainersQuery = useQuery({
    queryKey: ["trainers"],
    queryFn: api.listTrainers,
    enabled: authed,
    select: (d) => d.trainers,
    refetchInterval: poll,
    placeholderData: keepPreviousData,
  });

  const shiftsQuery = useQuery({
    queryKey: ["shifts", range?.from, range?.to],
    queryFn: () => api.listShifts(range!.from, range!.to),
    enabled: authed && range !== null,
    select: (d) => d.shifts,
    refetchInterval: poll,
    placeholderData: keepPreviousData,
  });

  const changesQuery = useQuery({
    queryKey: ["changes"],
    queryFn: () => api.listChanges(50),
    enabled: authed,
    select: (d) => d.changes,
    refetchInterval: poll,
    placeholderData: keepPreviousData,
  });

  const templateQuery = useQuery({
    queryKey: ["template"],
    queryFn: api.getTemplate,
    enabled: authed,
    select: (d) => d.slots,
    refetchInterval: poll,
    placeholderData: keepPreviousData,
  });

  /* private calendar — the API only ever returns the logged-in trainer's events */
  const personalQuery = useQuery({
    queryKey: ["personal", range?.from, range?.to],
    queryFn: () => api.listPersonalEvents(range!.from, range!.to),
    enabled: authed && range !== null,
    select: (d) => d.events,
    refetchInterval: poll,
    placeholderData: keepPreviousData,
  });

  const trainers = trainersQuery.data ?? [];
  const trainerMap = useMemo(() => new Map(trainers.map((x) => [x.id, x])), [trainers]);
  const changes = changesQuery.data ?? [];
  const templateSlots = templateQuery.data ?? [];
  const personalEvents = personalQuery.data ?? [];

  const visibleShifts = useMemo(
    () => (shiftsQuery.data ?? []).filter((s) => visibleKeys.has(s.date)),
    [shiftsQuery.data, visibleKeys],
  );

  /* ---------- unread badge for the changes bell ---------- */
  const unread = useMemo(() => {
    if (lastSeen === 0) return 0;
    const fresh = changes.filter((c) => new Date(c.createdAt).getTime() > lastSeen).length;
    return activityOpen && isDesktop ? 0 : fresh;
  }, [changes, lastSeen, activityOpen, isDesktop]);

  /* epoch ms timestamp of the last sheet dismissal — guards against the ghost
   * click that lands on the bell right after the overlay unmounts and would
   * instantly re-open the feed (tap-to-close felt like "it never closes"). */
  const lastDismissAt = useRef(0);
  /* ref mirror of activityOpen — lets handlers react to the current value
   * without impure state updaters or setState-in-effect */
  const activityOpenRef = useRef(activityOpen);

  const markSeen = useCallback(() => {
    const now = Date.now();
    localStorage.setItem("gs-lastSeen", String(now));
    setLastSeen(now);
  }, []);

  /* single event-driven entry point for the feed visibility (aside + sheet):
   * opening the feed also clears the unread badge */
  const setFeedOpen = useCallback(
    (o: boolean) => {
      activityOpenRef.current = o;
      if (o) markSeen();
      setActivityOpen(o);
    },
    [markSeen],
  );

  const toggleActivity = useCallback(() => {
    if (Date.now() - lastDismissAt.current < 450) return;
    setFeedOpen(!activityOpenRef.current);
  }, [setFeedOpen]);

  const handleSheetOpenChange = useCallback(
    (o: boolean) => {
      if (!o) lastDismissAt.current = Date.now();
      setFeedOpen(o);
    },
    [setFeedOpen],
  );

  /* ---------- error message helper ---------- */
  const errText = useCallback(
    (e: unknown) => (e instanceof ApiError ? (t.errors[e.code] ?? t.errors.network) : t.errors.network),
    [t],
  );

  /* ---------- shift mutations ---------- */
  const onCreate = useMutation({
    mutationFn: (draft: { date: string; trainerId: string; startMin: number; endMin: number; note?: string }) =>
      api.createShift(draft),
    onSuccess: () => {
      toast.success(t.toasts.added);
      qc.invalidateQueries({ queryKey: ["shifts"] });
    },
    onError: (e) => toast.error(errText(e)),
  });

  const onUpdate = useMutation({
    mutationFn: ({ id, ...patch }: { id: string; trainerId?: string; startMin?: number; endMin?: number; note?: string }) =>
      api.updateShift(id, patch),
    onSuccess: () => {
      toast.success(t.toasts.updated);
      qc.invalidateQueries({ queryKey: ["shifts"] });
    },
    onError: (e) => toast.error(errText(e)),
  });

  const onDelete = useMutation({
    mutationFn: (id: string) => api.deleteShift(id),
    onSuccess: () => {
      toast.success(t.toasts.deleted);
      qc.invalidateQueries({ queryKey: ["shifts"] });
    },
    onError: (e) => toast.error(errText(e)),
  });

  const handleSave = useCallback(
    async (draft: { date: string; trainerId: string; startMin: number; endMin: number; note?: string }) => {
      if (editing) await onUpdate.mutateAsync({ id: editing.id, ...draft });
      else await onCreate.mutateAsync(draft);
    },
    [editing, onUpdate, onCreate],
  );

  const handleDelete = useCallback(
    (s: Shift) => {
      onDelete.mutateAsync(s.id).catch(() => undefined);
    },
    [onDelete],
  );

  /** dropped a moved/resized shared shift — one atomic drop: the main move
   *  (possibly to another day) + optional neighbour swap in ONE batch request;
   *  the server validates the final state and applies it in a transaction */
  const onShiftMoveOps = useMutation({
    mutationFn: (ops: Array<{ id: string; date?: string; startMin: number; endMin: number }>) =>
      api.updateShiftsBatch(ops),
    onSuccess: () => {
      toast.success(t.toasts.updated);
      qc.invalidateQueries({ queryKey: ["shifts"] });
    },
    onError: (e) => toast.error(errText(e)),
  });

  const handleShiftMove = useCallback(
    ({ shift, date, startMin, endMin, swapWith }: ShiftMoveSpec) => {
      const ops: Array<{ id: string; date?: string; startMin: number; endMin: number }> = [
        { id: shift.id, ...(date && date !== shift.date ? { date } : {}), startMin, endMin },
      ];
      if (swapWith) {
        ops.push({
          id: swapWith.shift.id,
          startMin: swapWith.startMin,
          endMin: swapWith.endMin,
        });
      }
      onShiftMoveOps.mutate(ops);
    },
    [onShiftMoveOps],
  );

  /* ---------- personal calendar mutations (private — no feed entries) ---------- */
  const onPersonalSaved = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["personal"] });
  }, [qc]);

  const onCreatePersonal = useMutation({
    mutationFn: (draft: {
      date: string;
      title: string;
      startMin: number;
      endMin: number;
      allDay: boolean;
      note?: string;
      color?: string | null;
      repeat?: RepeatKind;
    }) => api.createPersonalEvent(draft),
    onSuccess: () => {
      toast.success(t.personal.added);
      onPersonalSaved();
    },
    onError: (e) => toast.error(errText(e)),
  });

  const onUpdatePersonal = useMutation({
    mutationFn: ({ id, occ, scope, ...patch }: {
      id: string;
      date?: string;
      title?: string;
      startMin?: number;
      endMin?: number;
      allDay?: boolean;
      note?: string | null;
      color?: string | null;
      repeat?: RepeatKind;
      /** occurrence scope (recurring series only) */
      occ?: string;
      scope?: "this" | "series";
    }) => api.updatePersonalEvent(id, patch, occ ? { occ, scope } : undefined),
    onSuccess: () => {
      toast.success(t.personal.updated);
      onPersonalSaved();
    },
    onError: (e) => toast.error(errText(e)),
  });

  const onDeletePersonal = useMutation({
    mutationFn: ({ id, occ, scope }: { id: string; occ?: string; scope?: "this" | "series" }) =>
      api.deletePersonalEvent(id, occ ? { occ, scope } : undefined),
    onSuccess: () => {
      toast.success(t.personal.deleted);
      onPersonalSaved();
    },
    onError: (e) => toast.error(errText(e)),
  });

  const handlePersonalSave = useCallback(
    async (draft: {
      date: string;
      title: string;
      startMin: number;
      endMin: number;
      allDay: boolean;
      note?: string;
      color: string | null;
      repeat: RepeatKind;
    }) => {
      const ev = editingPersonal;
      if (ev) {
        /* recurring occurrences: date change detaches this event (scope=this),
         * other edits apply to the whole series (Google semantics) */
        if (ev.repeat && ev.repeat !== "none") {
          const scope = draft.date !== ev.date ? "this" : "series";
          await onUpdatePersonal.mutateAsync({ id: ev.id.split("~")[0], occ: ev.date, scope, ...draft });
        } else {
          await onUpdatePersonal.mutateAsync({ id: ev.id, ...draft });
        }
      } else {
        await onCreatePersonal.mutateAsync(draft);
      }
    },
    [editingPersonal, onUpdatePersonal, onCreatePersonal],
  );

  const handlePersonalDelete = useCallback(
    async (scope: "this" | "series") => {
      const ev = editingPersonal;
      if (!ev) return;
      if (ev.repeat && ev.repeat !== "none") {
        const realId = ev.id.split("~")[0];
        if (scope === "this") await onDeletePersonal.mutateAsync({ id: realId, occ: ev.date, scope: "this" });
        else await onDeletePersonal.mutateAsync({ id: realId });
      } else {
        await onDeletePersonal.mutateAsync({ id: ev.id });
      }
    },
    [editingPersonal, onDeletePersonal],
  );

  /** dropped a moved/resized block — one atomic drop: main move + optional
   *  neighbour swap (two API updates, one toast); occurrence moves detach
   *  (scope=this), cross-day drags pass the new date */
  const onPersonalMoveOps = useMutation({
    mutationFn: async (
      ops: Array<{
        id: string;
        occ?: string;
        scope?: "this" | "series";
        date?: string;
        startMin: number;
        endMin: number;
      }>,
    ) => {
      for (const { id, occ, scope, ...patch } of ops) {
        await api.updatePersonalEvent(id, patch, occ ? { occ, scope } : undefined);
      }
    },
    onSuccess: () => {
      toast.success(t.personal.updated);
      onPersonalSaved();
    },
    onError: (e) => toast.error(errText(e)),
  });

  const handlePersonalMove = useCallback(
    ({ event, date, startMin, endMin, swapWith }: PersonalMoveSpec) => {
      const opFor = (
        ev: PersonalEvent,
        patch: { date?: string; startMin: number; endMin: number },
      ) => {
        const datePatch = patch.date && patch.date !== ev.date ? { date: patch.date } : {};
        if (ev.repeat && ev.repeat !== "none") {
          return {
            id: ev.id.split("~")[0],
            occ: ev.date,
            scope: "this" as const,
            startMin: patch.startMin,
            endMin: patch.endMin,
            ...datePatch,
          };
        }
        return { id: ev.id, startMin: patch.startMin, endMin: patch.endMin, ...datePatch };
      };
      const ops = [opFor(event, { date, startMin, endMin })];
      if (swapWith) {
        ops.push(
          opFor(swapWith.event, { startMin: swapWith.startMin, endMin: swapWith.endMin }),
        );
      }
      onPersonalMoveOps.mutate(ops);
    },
    [onPersonalMoveOps],
  );

  /* ---------- template mutations ---------- */
  const onSaveTemplate = useMutation({
    mutationFn: (slots: TemplateSlotInput[]) => api.saveTemplate(slots),
    onSuccess: () => {
      toast.success(t.template.saved);
      qc.invalidateQueries({ queryKey: ["template"] });
    },
    onError: (e) => toast.error(errText(e)),
  });

  const onApplyTemplate = useMutation({
    mutationFn: (from: string) => api.applyTemplate(from),
    onSuccess: (res) => {
      toast.success(t.template.applied(res.created));
      qc.invalidateQueries({ queryKey: ["shifts"] });
      qc.invalidateQueries({ queryKey: ["template"] });
    },
    onError: (e) => toast.error(errText(e)),
  });

  /* ---------- profile mutation ---------- */
  const onUpdateProfile = useMutation({
    mutationFn: (patch: { phone?: string; pin?: string }) =>
      api.updateTrainer(user!.id, patch),
    onSuccess: () => {
      toast.success(t.profile.saved);
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["trainers"] });
    },
    onError: (e) => toast.error(errText(e)),
  });

  /* ---------- team management (admin) ---------- */
  const onAddTrainer = useMutation({
    mutationFn: (body: { name: string; pin: string; phone?: string }) => api.addTrainer(body),
    onSuccess: (res) => {
      toast.success(t.trainersDialog.created(res.trainer.name));
      qc.invalidateQueries({ queryKey: ["trainers"] });
    },
    onError: (e) => toast.error(errText(e)),
  });

  const onDeleteTrainer = useMutation({
    mutationFn: (tr: Trainer) => api.deleteTrainer(tr.id).then(() => tr),
    onSuccess: (tr) => {
      toast.success(t.trainersDialog.deleted(tr.name));
      // the server cascade removed this trainer's shifts + template slots
      qc.invalidateQueries({ queryKey: ["trainers"] });
      qc.invalidateQueries({ queryKey: ["shifts"] });
      qc.invalidateQueries({ queryKey: ["template"] });
    },
    onError: (e) => toast.error(errText(e)),
  });

  const handleLogout = useCallback(() => {
    signOut();
    qc.clear();
  }, [signOut, qc]);

  const handleAuthed = useCallback(
    (authToken: string, trainer: { name: string } & { id: string }) => {
      /* seed the cache with the login/register response — no extra /me roundtrip */
      qc.setQueryData(["me"], { trainer });
      signIn(authToken);
      toast.success(t.auth.welcome(trainer.name));
    },
    [signIn, qc, t],
  );
  /* ---------- period navigation ---------- */
  const step = useCallback(
    (dir: 1 | -1) => {
      setAnchor((a) => {
        if (view === "month") return addMonths(a, dir);
        const delta = view === "day" ? 1 : view === "3d" ? 3 : 7;
        return addDays(a, dir * delta);
      });
    },
    [view],
  );

  const goToday = useCallback(() => setAnchor(startOfDay(new Date())), []);

  /* ---------- font scale / calendar mode ---------- */
  const stepFont = useCallback((dir: 1 | -1) => {
    setFontScale((s) => clampFont(s + dir * FONT_STEP));
  }, []);

  const resetFont = useCallback(() => setFontScale(1), []);

  const toggleMode = useCallback(() => {
    const next: CalendarMode = mode === "team" ? "personal" : "team";
    localStorage.setItem("gs-cal-mode", next);
    setMode(next);
  }, [mode]);

  const openAdd = useCallback(() => {
    setEditing(null);
    setDialogDefaults({
      date: dateKey(view === "month" ? new Date() : viewDays[0] ?? new Date()),
      trainerId: user?.id,
    });
    setDialogOpen(true);
  }, [view, viewDays, user]);

  const openEdit = useCallback((s: Shift) => {
    setEditing(s);
    setDialogOpen(true);
  }, []);

  /** Google-style drag-to-create in the TEAM calendar — open the shift dialog
   *  prefilled with the dragged range (clamped to that day's working window) */
  const openShiftCreateAt = useCallback(
    (spec: GridDragSpec) => {
      const w = DAY_WINDOWS[dateFromKey(spec.date).getDay()] ?? { start: 450, end: 1350 };
      const startMin = Math.min(Math.max(spec.startMin, w.start), w.end - 15);
      const endMin = Math.min(Math.max(spec.endMin, startMin + 15), w.end);
      setEditing(null);
      setDialogDefaults({ date: spec.date, trainerId: user?.id, startMin, endMin });
      setDialogOpen(true);
    },
    [user],
  );

  const openAddPersonal = useCallback(() => {
    setEditingPersonal(null);
    setPersonalDefaults({
      date: dateKey(view === "month" ? new Date() : viewDays[0] ?? new Date()),
    });
    setPersonalOpen(true);
  }, [view, viewDays]);

  const openEditPersonal = useCallback((e: PersonalEvent) => {
    setEditingPersonal(e);
    setPersonalOpen(true);
  }, []);

  /* ---------- Google-style quick create (personal calendar) ---------- */
  /** the grid listens for this to drop the pending rubber-band preview */
  const clearDragSelection = useCallback(() => {
    window.dispatchEvent(new Event("gymshift:clear-drag-selection"));
  }, []);

  const closeQuick = useCallback(() => {
    clearDragSelection();
    setQuickDraft(null);
  }, [clearDragSelection]);

  /** the grid finished a drag (or an empty-slot click) — open the popup */
  const openQuickFromGrid = useCallback(
    (spec: { date: string; startMin: number; endMin: number; anchor: { x: number; y: number } }) => {
      setQuickDraft(spec);
    },
    [],
  );

  /** month cell tapped — same popup, default one-hour slot on that date */
  const openQuickFromDate = useCallback((date: string) => {
    const now = new Date();
    const start =
      date === dateKey(now)
        ? Math.min(Math.ceil((now.getHours() * 60 + now.getMinutes()) / 60) * 60, 23 * 60)
        : 9 * 60;
    setQuickDraft({ date, startMin: start, endMin: Math.min(start + 60, 1440), anchor: null });
  }, []);

  const handleQuickSave = useCallback(
    async (picked: { title: string; color: string | null; repeat: RepeatKind }) => {
      if (!quickDraft) return;
      await onCreatePersonal.mutateAsync({
        date: quickDraft.date,
        title: picked.title,
        startMin: quickDraft.startMin,
        endMin: quickDraft.endMin,
        allDay: false,
        color: picked.color,
        repeat: picked.repeat,
      });
      clearDragSelection();
      setQuickDraft(null);
    },
    [quickDraft, onCreatePersonal, clearDragSelection],
  );

  /** «Подробнее» — reopen as the full editor with the same date/time prefilled */
  const handleQuickMore = useCallback(
    (picked: { color: string | null; repeat: RepeatKind }) => {
      if (!quickDraft) return;
      setEditingPersonal(null);
      setPersonalDefaults({
        date: quickDraft.date,
        startMin: quickDraft.startMin,
        endMin: quickDraft.endMin,
        allDay: false,
        color: picked.color,
        repeat: picked.repeat,
      });
      clearDragSelection();
      setQuickDraft(null);
      setPersonalOpen(true);
    },
    [quickDraft, clearDragSelection],
  );

  const openDay = useCallback((d: Date) => {
    setView("day");
    setAnchor(startOfDay(d));
  }, []);

  /* ---------- gates ---------- */
  if (!ready) return <BootSplash />;

  if (!token) {
    return <AuthScreen lang={lang} t={t} onAuthed={handleAuthed} />;
  }

  if (meQuery.isPending) return <BootSplash />;

  /* token present but /me says «not logged in» — one frame until the effect signs out */
  if (meQuery.isSuccess && !meQuery.data?.trainer) return <BootSplash />;

  if (meQuery.isError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Dumbbell className="size-6" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold">{t.errorTitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">{errText(meQuery.error)}</p>
        </div>
        <button
          type="button"
          onClick={() => meQuery.refetch()}
          className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-accent"
        >
          <RotateCw className="size-4" aria-hidden="true" />
          {t.retry}
        </button>
      </div>
    );
  }

  /* ---------- main app ---------- */
  /* grid-level load state follows the active calendar mode */
  const gridPending = mode === "personal" ? personalQuery.isPending : shiftsQuery.isPending;
  const gridError = mode === "personal" ? personalQuery.error : shiftsQuery.error;
  const retryGrid = () => {
    if (mode === "personal") void personalQuery.refetch();
    else void shiftsQuery.refetch();
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <HeaderBar
        lang={lang}
        onLangChange={setLang}
        themeId={themeId}
        onThemeChange={setThemeId}
        activityOpen={activityOpen}
        onToggleActivity={toggleActivity}
        unread={unread}
        user={user}
        trainers={trainers}
        isAdmin={isAdmin}
        addingTrainer={onAddTrainer.isPending}
        deletingTrainerId={onDeleteTrainer.isPending ? (onDeleteTrainer.variables?.id ?? null) : null}
        onAddTrainer={async (body) => (await onAddTrainer.mutateAsync(body)).trainer}
        onDeleteTrainer={async (tr) => {
          await onDeleteTrainer.mutateAsync(tr);
        }}
        connected={connected}
        fontScale={fontScale}
        onFontStep={stepFont}
        onFontReset={resetFont}
        onOpenTemplate={() => setTemplateOpen(true)}
        canInstall={canInstall}
        onInstall={() => void promptInstall()}
        onLogout={handleLogout}
        savingProfile={onUpdateProfile.isPending}
        onUpdateProfile={async (patch) => {
          await onUpdateProfile.mutateAsync(patch);
        }}
        t={t}
      />

      <main className="flex min-w-0 flex-1 flex-col lg:flex-row">
        <section className="flex min-w-0 flex-1 flex-col">
          <CalendarToolbar
            view={view}
            title={title}
            onPrev={() => step(-1)}
            onNext={() => step(1)}
            onToday={goToday}
            onViewChange={setView}
            onAdd={mode === "personal" ? openAddPersonal : openAdd}
            mode={mode}
            onToggleMode={toggleMode}
            t={t}
          />

          <div className="flex-1 px-3 pb-8 sm:px-4">
            {gridPending ? (
              <CalendarSkeleton />
            ) : gridError ? (
              <LoadError message={errText(gridError)} onRetry={retryGrid} t={t} />
            ) : view === "month" ? (
              <MonthGrid
                cells={monthCellList}
                shifts={visibleShifts}
                personalEvents={mode === "personal" ? personalEvents : []}
                mode={mode}
                lang={lang}
                t={t}
                trainers={trainerMap}
                onEdit={openEdit}
                onEditPersonal={mode === "personal" ? openEditPersonal : undefined}
                onAddPersonal={openAddPersonal}
                onOpenDay={openDay}
                onCreateAtPersonal={mode === "personal" ? openQuickFromDate : undefined}
              />
            ) : (
              <MultiDayGrid
                days={viewDays}
                shifts={visibleShifts}
                /* PRIVACY: the shared calendar never renders private events —
                 * not even the owner's own ones (they live ONLY in the
                 * personal calendar; no bars/chips/overlays in team mode) */
                personalEvents={mode === "personal" ? personalEvents : []}
                mode={mode}
                lang={lang}
                t={t}
                trainers={trainerMap}
                rowH={
                  view === "week" ? (isNarrow ? 44 : 56) : isNarrow && view === "3d" ? 56 : 64
                }
                narrow={isNarrow}
                onEdit={openEdit}
                onDelete={handleDelete}
                onEditPersonal={mode === "personal" ? openEditPersonal : undefined}
                onAddPersonal={openAddPersonal}
                onCreateAt={mode === "personal" ? openQuickFromGrid : openShiftCreateAt}
                onMovePersonal={mode === "personal" ? handlePersonalMove : undefined}
                onMoveShift={mode === "team" ? handleShiftMove : undefined}
              />
            )}
          </div>
        </section>

        {!isDesktop ? null : (
          <ActivityPanel
            open={activityOpen}
            entries={changes}
            trainers={trainers}
            me={user}
            lang={lang}
            t={t}
            loading={changesQuery.isPending}
          />
        )}
      </main>

      {/* mobile / tablet activity drawer */}
      {!isDesktop && (
        <ActivityPanel
          asSheet
          sheetOpen={activityOpen}
          onSheetOpenChange={handleSheetOpenChange}
          onClose={() => handleSheetOpenChange(false)}
          entries={changes}
          trainers={trainers}
          me={user}
          lang={lang}
          t={t}
          loading={changesQuery.isPending}
        />
      )}

      <ShiftDialog
        key={`${dialogOpen}-${editing?.id ?? "new"}`}
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) {
            setEditing(null);
            /* a cancelled/saved drag-create must not leave the pending
             * rubber-band preview hanging on the grid */
            clearDragSelection();
          }
        }}
        shift={editing}
        defaults={dialogDefaults}
        trainers={trainers}
        t={t}
        onSave={handleSave}
      />

      <PersonalEventDialog
        key={`pe-${personalOpen}-${editingPersonal?.id ?? "new"}`}
        open={personalOpen}
        onOpenChange={(o) => {
          setPersonalOpen(o);
          if (!o) setEditingPersonal(null);
        }}
        event={editingPersonal}
        defaults={personalDefaults}
        t={t}
        lang={lang}
        onSave={handlePersonalSave}
        onDelete={editingPersonal ? handlePersonalDelete : undefined}
      />

      {/* Google-style quick create — appears right after a grid drag */}
      {quickDraft && mode === "personal" && (
        <PersonalQuickCreate
          spec={quickDraft}
          narrow={isNarrow}
          lang={lang}
          t={t}
          onSave={handleQuickSave}
          onMore={handleQuickMore}
          onCancel={closeQuick}
        />
      )}

      <TemplateDialog
        key={`tpl-${templateOpen}`}
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        slots={templateSlots}
        trainers={trainers}
        isAdmin={isAdmin}
        lang={lang}
        t={t}
        saving={onSaveTemplate.isPending}
        applying={onApplyTemplate.isPending}
        onSaveTemplate={async (slots) => (await onSaveTemplate.mutateAsync(slots)).slots}
        onApplyTemplate={async (from) => (await onApplyTemplate.mutateAsync(from)).created}
      />

      <footer className="mt-auto border-t border-border bg-bg-header">
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-xs text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">GymShift</span> · {t.footerTag}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`size-2 rounded-full transition-colors ${
                connected ? "bg-emerald-500" : "bg-muted-foreground/40"
              }`}
            />
            {t.footerAutosave} · {connected ? t.connection.online : t.connection.offline}
          </span>
        </div>
      </footer>
    </div>
  );
}
