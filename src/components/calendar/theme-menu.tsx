"use client";

import { useState } from "react";
import { Check, Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { THEMES } from "@/lib/themes";
import type { Dict } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

interface ThemeMenuProps {
  themeId: string;
  onThemeChange: (id: string) => void;
  lang: Lang;
  t: Dict;
}

/** One-click theme switcher in the header — small dropdown with 10 themes + auto */
export function ThemeMenu({ themeId, onThemeChange, lang, t }: ThemeMenuProps) {
  const [open, setOpen] = useState(false);
  const current = THEMES.find((x) => x.id === themeId);
  const label = themeId === "auto" ? t.themeAuto : current ? (lang === "he" ? current.he : current.ru) : t.theme;
  const lights = THEMES.filter((x) => x.group === "light");
  const darks = THEMES.filter((x) => x.group === "dark");

  const renderRow = (id: string, name: string, swatch?: string, accent?: string) => (
    <button
      key={id}
      type="button"
      role="menuitemradio"
      aria-checked={themeId === id}
      onClick={() => {
        onThemeChange(id);
        setOpen(false);
      }}
      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent"
    >
      {swatch ? (
        <span
          aria-hidden="true"
          className="size-5 shrink-0 rounded-full border border-border shadow-inner"
          style={{ background: `linear-gradient(135deg, ${swatch} 62%, ${accent} 62%)` }}
        />
      ) : (
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border bg-secondary">
          <Clock className="size-3 text-muted-foreground" />
        </span>
      )}
      <span className="truncate">{name}</span>
      {themeId === id && <Check className="ms-auto size-4 text-primary" />}
    </button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-lg px-2.5" aria-label={t.theme}>
          <span
            aria-hidden="true"
            className="size-3.5 rounded-full"
            style={{
              background:
                current && themeId !== "auto"
                  ? `linear-gradient(135deg, ${current.swatch} 62%, ${current.accent} 62%)`
                  : "conic-gradient(#faf6ee 0 25%, #d97706 0 50%, #1b1d22 0 75%, #2dd4bf 0)",
            }}
          />
          <span className="hidden max-w-24 truncate md:inline">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-2" role="menu" aria-label={t.theme}>
        {renderRow("auto", t.themeAuto)}
        <Separator className="my-2" />
        <p className="px-2 py-1 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
          {t.lightGroup}
        </p>
        {lights.map((th) => renderRow(th.id, lang === "he" ? th.he : th.ru, th.swatch, th.accent))}
        <p className="px-2 pb-1 pt-2 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
          {t.darkGroup}
        </p>
        {darks.map((th) => renderRow(th.id, lang === "he" ? th.he : th.ru, th.swatch, th.accent))}
      </PopoverContent>
    </Popover>
  );
}
