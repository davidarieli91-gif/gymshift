"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Dumbbell, KeyRound, Loader2, MessageCircle, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, api } from "@/lib/api";
import { firstName } from "@/lib/format";
import type { Dict } from "@/lib/i18n";
import type { Lang, Trainer } from "@/lib/types";

interface AuthScreenProps {
  lang: Lang;
  t: Dict;
  /** called after successful login/register (trainer + token from the API) */
  onAuthed: (token: string, trainer: Trainer) => void;
}

const PIN_RE = /^\d{4,8}$/;

/** Full-screen gate: login or quick registration (name + PIN, optional phone) */
export function AuthScreen({ lang, t, onAuthed }: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  /** registered trainer names for one-tap login (public endpoint, names only) */
  const [names, setNames] = useState<string[]>([]);

  /* load name suggestions once — silent failure keeps manual entry working */
  useEffect(() => {
    let alive = true;
    api
      .listNames()
      .then((d) => {
        if (alive) setNames(d.names);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const a = t.auth;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    if (trimmedName.length < 2) return setFieldError(a.errName);
    if (!PIN_RE.test(pin)) return setFieldError(a.errPin);
    if (mode === "register" && pin !== pin2) return setFieldError(a.errPinMatch);
    const digits = trimmedPhone.replace(/\D/g, "");
    if (trimmedPhone !== "" && digits.length < 6) return setFieldError(a.errPhone);

    setFieldError(null);
    setBusy(true);
    try {
      const res =
        mode === "login"
          ? await api.login({ name: trimmedName, pin })
          : await api.register({
              name: trimmedName,
              pin,
              ...(trimmedPhone ? { phone: trimmedPhone } : {}),
            });
      onAuthed(res.token, res.trainer);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "network";
      toast.error(t.errors[code]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-8">
      {/* soft decorative blobs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -start-24 size-72 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -end-20 size-80 rounded-full bg-primary/10 blur-3xl"
      />

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative w-full max-w-sm"
      >
        {/* logo + tagline */}
        <div className="mb-6 flex flex-col items-center gap-2.5 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
            <Dumbbell className="size-7" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">GymShift</h1>
            <p className="text-sm text-muted-foreground">{a.tagline}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "register")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login" className="min-h-9">
                {a.tabLogin}
              </TabsTrigger>
              <TabsTrigger value="register" className="min-h-9">
                {a.tabRegister}
              </TabsTrigger>
            </TabsList>

            <form onSubmit={submit} className="mt-5 grid gap-4" noValidate>
              <div className="grid gap-2">
                <Label htmlFor="auth-name">{a.name}</Label>
                <div className="relative">
                  <UserRound
                    aria-hidden="true"
                    className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="auth-name"
                    className="min-h-11 ps-9"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={a.namePh}
                    maxLength={40}
                    autoComplete="username"
                    list="auth-names-list"
                    dir={lang === "he" ? "rtl" : "ltr"}
                  />
                  <datalist id="auth-names-list">
                    {names.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                </div>
              </div>

              {mode === "login" && names.length > 0 && (
                <div className="grid gap-1.5">
                  <p className="text-[0.6875rem] text-muted-foreground">{a.pickName}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {names.map((n) => {
                      const active = name.trim().toLowerCase() === n.toLowerCase();
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setName(n)}
                          aria-pressed={active}
                          className={`min-h-9 rounded-full border px-3 text-xs font-medium transition-colors ${
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card text-foreground hover:bg-accent"
                          }`}
                        >
                          {firstName(n)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="auth-pin">{a.pin}</Label>
                <div className="relative">
                  <KeyRound
                    aria-hidden="true"
                    className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="auth-pin"
                    className="min-h-11 ps-9"
                    type="password"
                    inputMode="numeric"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    placeholder={a.pinPh}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    dir="ltr"
                  />
                </div>
              </div>

              {mode === "register" && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="auth-pin2">{a.pinConfirm}</Label>
                    <Input
                      id="auth-pin2"
                      className="min-h-11"
                      type="password"
                      inputMode="numeric"
                      value={pin2}
                      onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 8))}
                      placeholder={a.pinConfirmPh}
                      autoComplete="new-password"
                      dir="ltr"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="auth-phone">
                      {a.phone}{" "}
                      <span className="font-normal text-muted-foreground">({a.phoneOptional})</span>
                    </Label>
                    <Input
                      id="auth-phone"
                      className="min-h-11"
                      type="tel"
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder={a.phonePh}
                      dir="ltr"
                    />
                    <p className="flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
                      <MessageCircle className="size-3.5 shrink-0" aria-hidden="true" />
                      {a.phoneHint}
                    </p>
                  </div>

                  <p className="rounded-lg bg-secondary/60 px-3 py-2 text-[0.6875rem] leading-relaxed text-muted-foreground">
                    {a.registerNote}
                  </p>
                </>
              )}

              {fieldError && (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {fieldError}
                </p>
              )}

              <Button type="submit" className="h-11 w-full text-sm font-semibold" disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {mode === "login" ? a.loginBtn : a.registerBtn}
              </Button>
            </form>
          </Tabs>
        </div>

        {/* demo credentials */}
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <KeyRound className="size-3.5" aria-hidden="true" />
          <span>{a.demoHint}</span>
        </div>
      </motion.div>
    </div>
  );
}
