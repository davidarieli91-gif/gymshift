// Typed REST client for GymShift (see SPEC.md for the exact contract).
// - Bearer token from localStorage "gs-token"
// - ApiError carries the server error code ("window", "overlap", ...)
// - on 401 the stored token is cleared and a global event is dispatched

import type {
  ChangeEntry,
  PersonalEvent,
  PersonalEventDraft,
  Role,
  Shift,
  TemplateSlot,
  TemplateSlotInput,
  Trainer,
} from "./types";

export type ApiErrorCode =
  | "bad_request"
  | "name_taken"
  | "invalid"
  | "forbidden"
  | "not_found"
  | "window"
  | "overlap"
  | "unauthorized"
  | "network";

export const TOKEN_KEY = "gs-token";

/** Thrown for every failed request; `code` maps to localized messages */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(code: ApiErrorCode, status: number, message?: string) {
    super(message ?? code);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage may be unavailable (private mode) */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
  // let the auth store react (sign out the UI)
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("gs-unauthorized"));
  }
}

function errorCode(status: number, raw: unknown): ApiErrorCode {
  if (raw && typeof raw === "object" && "error" in raw) {
    const e = (raw as { error: unknown }).error;
    if (typeof e === "string" && e.length > 0) return e as ApiErrorCode;
  }
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  return "bad_request";
}

async function request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init?.body !== undefined) headers["content-type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(path, {
      method: init?.method ?? "GET",
      headers,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiError("network", 0);
  }

  let raw: unknown = null;
  try {
    raw = await res.json();
  } catch {
    /* non-JSON body (proxy error page, empty 204 …) */
  }

  if (!res.ok) {
    const code = errorCode(res.status, raw);
    // expired/invalid session → forget the token everywhere
    // (skipped on the login/register calls themselves — a wrong PIN there
    //  is just a failed attempt, not a session loss)
    if (res.status === 401 && !path.startsWith("/api/auth/login") && !path.startsWith("/api/auth/register")) {
      clearToken();
    }
    throw new ApiError(code, res.status);
  }
  return raw as T;
}

/* ------------------------------------------------------------------ */
/* API surface                                                         */
/* ------------------------------------------------------------------ */

export interface AuthResponse {
  token: string;
  trainer: Trainer;
}

export const api = {
  health: () => request<{ ok: boolean; service: string }>("/api"),

  register: (body: { name: string; pin: string; phone?: string }) =>
    request<AuthResponse>("/api/auth/register", { method: "POST", body }),

  login: (body: { name: string; pin: string }) =>
    request<AuthResponse>("/api/auth/login", { method: "POST", body }),

  /** 200 with `trainer: null` when the token is missing/expired (logged out). */
  me: () => request<{ trainer: Trainer | null }>("/api/auth/me"),

  /** Public: registered trainer names for login suggestions (no PINs/phones). */
  listNames: () => request<{ names: string[] }>("/api/auth/names"),

  listTrainers: () => request<{ trainers: Trainer[] }>("/api/trainers"),

  /** admin only: create a trainer directly (name + PIN + optional phone) */
  addTrainer: (body: { name: string; pin: string; phone?: string }) =>
    request<{ trainer: Trainer }>("/api/trainers", { method: "POST", body }),

  updateTrainer: (id: string, patch: { phone?: string; pin?: string; role?: Role }) =>
    request<{ trainer: Trainer }>(`/api/trainers/${id}`, { method: "PATCH", body: patch }),

  deleteTrainer: (id: string) => request<{ ok: true }>(`/api/trainers/${id}`, { method: "DELETE" }),

  listShifts: (from: string, to: string) =>
    request<{ shifts: Shift[] }>(`/api/shifts?from=${from}&to=${to}`),

  createShift: (body: { date: string; trainerId: string; startMin: number; endMin: number; note?: string }) =>
    request<{ shift: Shift }>("/api/shifts", { method: "POST", body }),

  updateShift: (id: string, body: { trainerId?: string; startMin?: number; endMin?: number; note?: string }) =>
    request<{ shift: Shift }>(`/api/shifts/${id}`, { method: "PUT", body }),

  deleteShift: (id: string) => request<{ ok: true }>(`/api/shifts/${id}`, { method: "DELETE" }),

  /**
   * Atomic drag & drop update: one move (with optional new date) plus its
   * optional swap neighbour — validated against the final state server-side
   * and applied in a single transaction.
   */
  updateShiftsBatch: (
    ops: Array<{ id: string; date?: string; startMin: number; endMin: number }>,
  ) => request<{ shifts: Shift[] }>("/api/shifts/batch", { method: "POST", body: { ops } }),

  /* ---------- personal calendar (strictly owner-only) ---------- */

  listPersonalEvents: (from: string, to: string) =>
    request<{ events: PersonalEvent[] }>(`/api/personal-events?from=${from}&to=${to}`),

  createPersonalEvent: (body: {
    date: string;
    title: string;
    startMin: number;
    endMin: number;
    allDay?: boolean;
    note?: string;
    color?: string | null;
    repeat?: PersonalEventDraft["repeat"];
  }) => request<{ event: PersonalEvent }>("/api/personal-events", { method: "POST", body }),

  /**
   * `opts` only matters for recurring series: `occ` = the occurrence being
   * edited, `scope: "this"` → detach that occurrence (exception + standalone).
   */
  updatePersonalEvent: (
    id: string,
    body: {
      date?: string;
      title?: string;
      startMin?: number;
      endMin?: number;
      allDay?: boolean;
      note?: string | null;
      color?: string | null;
      repeat?: PersonalEventDraft["repeat"];
    },
    opts?: { occ?: string; scope?: "this" | "series" },
  ) => {
    const q = new URLSearchParams();
    if (opts?.occ) q.set("occ", opts.occ);
    if (opts?.scope) q.set("scope", opts.scope);
    const qs = q.toString();
    return request<{ event: PersonalEvent }>(
      `/api/personal-events/${id}${qs ? `?${qs}` : ""}`,
      { method: "PUT", body },
    );
  },

  /** `opts` → occurrence-level delete (`?occ=…&scope=this`) of a series */
  deletePersonalEvent: (id: string, opts?: { occ?: string; scope?: "this" | "series" }) => {
    const q = new URLSearchParams();
    if (opts?.occ) q.set("occ", opts.occ);
    if (opts?.scope) q.set("scope", opts.scope);
    const qs = q.toString();
    return request<{ ok: true }>(`/api/personal-events/${id}${qs ? `?${qs}` : ""}`, {
      method: "DELETE",
    });
  },

  getTemplate: () => request<{ slots: TemplateSlot[] }>("/api/template"),

  saveTemplate: (slots: TemplateSlotInput[]) =>
    request<{ slots: TemplateSlot[] }>("/api/template", { method: "PUT", body: { slots } }),

  applyTemplate: (from: string) =>
    request<{ created: number }>("/api/template/apply", { method: "POST", body: { from } }),

  listChanges: (limit = 50) => request<{ changes: ChangeEntry[] }>(`/api/changes?limit=${limit}`),
};
