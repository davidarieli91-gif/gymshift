"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Dict } from "@/lib/i18n";

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  t: Dict;
}

/**
 * «Пригласить тренера»: the join link (current origin), copy button and a
 * WhatsApp share. A Dialog (not a popover) so it opens identically from the
 * desktop header button and from the mobile user menu.
 */
export function InviteDialog({ open, onOpenChange, t }: InviteDialogProps) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const waHref = `https://wa.me/?text=${encodeURIComponent(`${t.inviteWa} ${origin}`)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(origin);
      toast.success(t.copied);
    } catch {
      /* clipboard may be unavailable — link is still visible for manual copy */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-primary" aria-hidden="true" />
            {t.inviteTitle}
          </DialogTitle>
          <DialogDescription>{t.inviteDesc}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2.5">
          <span dir="ltr" className="flex-1 truncate font-mono text-xs">
            {origin ? origin.replace(/^https?:\/\//, "") : "…"}
          </span>
          <Button variant="outline" size="icon" className="size-8 shrink-0" onClick={copy} aria-label={t.copy}>
            {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
          </Button>
        </div>
        <Button variant="outline" className="h-10 w-full gap-1.5" asChild>
          <a href={waHref} target="_blank" rel="noreferrer">
            <MessageCircle className="size-4 text-emerald-600" aria-hidden="true" />
            {t.whatsapp.share}
          </a>
        </Button>
      </DialogContent>
    </Dialog>
  );
}
