"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Lock, Repeat, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EventColorPicker } from "./personal-color-picker";
import { dateFromKey, fmtDayFull, minToHHMM } from "@/lib/format";
import type { Dict } from "@/lib/i18n";
import type { Lang, PersonalEventDraft, RepeatKind } from "@/lib/types";

/**
 * Where a drag (or a click, or a month-cell tap) ended — the seed of a new
 * PRIVATE event, exactly like Google Calendar's drag-to-create.
 */
export interface PersonalQuickSpec {
  date: string;
  startMin: number;
  endMin: number;
  /** screen point that anchors the popup; null → centered card (mobile/flow creators) */
  anchor?: { x: number; y: number } | null;
}

interface PersonalQuickCreateProps {
  spec: PersonalQuickSpec;
  /** smartphone width — render as a centered top sheet instead of an anchored popover */
  narrow: boolean;
  lang: Lang;
  t: Dict;
  /** resolves → popup closes; rejects → parent toast shown, popup stays open */
  onSave: (draft: { title: string; color: string | null; repeat: RepeatKind }) => Promise<void>;
  /** «Подробнее» — abandon the popup in favour of the full dialog */
  onMore: (picked: { color: string | null; repeat: RepeatKind }) => void;
  onCancel: () => void;
}

/** popup width + height estimate for the flip-above logic */
const CARD_W = 340;
const CARD_H = 330;

/**
 * Google-Calendar-style quick create: after the user drags a time range and
 * releases, a small popup appears next to the selection with the title input
 * focused, a «repeat» selector and the color palette — the same trio Google
 * puts into its own bubble. Enter / «Сохранить» creates the event; Esc or a
 * click outside cancels; «Подробнее» opens the full editor with the same
 * times (and the already picked color/repeat) prefilled.
 *
 * The card never overflows: its width adapts to the viewport
 * (`min(340px, 100vw-24px)`) and every row wraps/truncates — fixes the RTL
 * screenshot bug where letters and buttons escaped the panel.
 */
export function PersonalQuickCreate({
  spec,
  narrow,
  lang,
  t,
  onSave,
  onMore,
  onCancel,
}: PersonalQuickCreateProps) {
  const [title, setTitle] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [repeat, setRepeat] = useState<RepeatKind>("none");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = title.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      await onSave({ title: name, color, repeat });
    } catch {
      /* error toast is shown by the mutation in page.tsx — keep the popup open */
    } finally {
      setBusy(false);
    }
  };

  /* anchored popover on desktop (clamped to the viewport, flips above when
   * there is no room below); centered top card on smartphones */
  const style = narrow
    ? undefined
    : (() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const w = Math.min(CARD_W, vw - 24);
        if (!spec.anchor) {
          return { left: Math.max(8, vw / 2 - w / 2), top: Math.max(8, vh / 2 - CARD_H / 2), width: w };
        }
        const left = Math.max(8, Math.min(spec.anchor.x - w / 2, vw - w - 8));
        let top = spec.anchor.y + 12;
        if (top + CARD_H > vh - 8) top = Math.max(8, spec.anchor.y - CARD_H - 12);
        return { left, top, width: w };
      })();

  const repeatLabel = (r: RepeatKind): string =>
    r === "daily"
      ? t.personal.repeatDaily
      : r === "weekly"
        ? t.personal.repeatWeekly
        : r === "monthly"
          ? t.personal.repeatMonthly
          : t.personal.repeatNone;

  return (
    <>
      {/* invisible click-away layer (Esc works too) — Google cancels the
          pending event when you click anywhere else */}
      <div aria-hidden="true" className="fixed inset-0 z-40" onClick={onCancel} />
      <div
        role="dialog"
        aria-label={t.personal.quickTitle}
        className={`fixed z-50 rounded-xl border border-border bg-card p-3 shadow-xl ${
          narrow ? "inset-x-3 top-20" : ""
        }`}
        style={style}
      >
        <form onSubmit={submit} className="grid gap-2.5" noValidate>
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Lock className="size-3.5 shrink-0" style={{ color: "var(--primary)" }} aria-hidden="true" />
            <span className="min-w-0 truncate">{t.personal.quickTitle}</span>
          </p>

          <Input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t.personal.titlePh}
            maxLength={80}
            disabled={busy}
            className="min-h-11 w-full"
          />

          {/* date · time — wraps instead of overflowing in narrow/RTL layouts */}
          <p className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className="min-w-0 flex-1 truncate">{fmtDayFull(dateFromKey(spec.date), lang)}</span>
            <span dir="ltr" className="shrink-0 font-semibold tabular-nums text-foreground">
              {minToHHMM(spec.startMin)}–{minToHHMM(spec.endMin)}
            </span>
          </p>

          {/* repeat selector + color palette — Google's quick-add trio */}
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
            <Select value={repeat} onValueChange={(v) => setRepeat(v as RepeatKind)}>
              <SelectTrigger
                aria-label={t.personal.repeat}
                className="h-8 w-auto max-w-[170px] gap-1.5 border-none bg-secondary/50 px-2.5 text-xs shadow-none"
              >
                <Repeat className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["none", "daily", "weekly", "monthly"] as const).map((r) => (
                  <SelectItem key={r} value={r} className="text-sm">
                    {repeatLabel(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <EventColorPicker value={color} onChange={setColor} lang={lang} t={t} size="sm" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-9 gap-1.5 text-muted-foreground"
              onClick={() => onMore({ color, repeat })}
              disabled={busy}
            >
              <Settings2 className="size-4" aria-hidden="true" />
              <span className="min-w-0 truncate">{t.personal.moreOptions}</span>
            </Button>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button type="button" size="sm" variant="outline" className="h-9" onClick={onCancel} disabled={busy}>
                {t.btn.cancel}
              </Button>
              <Button type="submit" size="sm" className="h-9" disabled={!title.trim() || busy}>
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {t.btn.save}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}

/** convenience alias for the picked extras carried out of the popup */
export type QuickExtras = Pick<PersonalEventDraft, "color" | "repeat">;
