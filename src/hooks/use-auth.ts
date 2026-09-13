"use client";

import { create } from "zustand";
import { TOKEN_KEY, clearToken, storeToken } from "@/lib/api";

interface AuthState {
  /** bearer token, null = logged out */
  token: string | null;
  /** true once localStorage has been read (client only) */
  ready: boolean;
  hydrate: () => void;
  signIn: (token: string) => void;
  signOut: () => void;
}

let listenerBound = false;

/**
 * Auth store backed by localStorage "gs-token".
 * The API client dispatches "gs-unauthorized" on any 401 — we listen once
 * and drop the token so the UI returns to the auth screen.
 */
export const useAuth = create<AuthState>((set) => ({
  token: null,
  ready: false,
  hydrate: () => {
    if (!listenerBound && typeof window !== "undefined") {
      listenerBound = true;
      window.addEventListener("gs-unauthorized", () => set({ token: null }));
    }
    let token: string | null = null;
    try {
      token = localStorage.getItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
    set({ token, ready: true });
  },
  signIn: (token) => {
    storeToken(token);
    set({ token });
  },
  signOut: () => {
    clearToken();
    set({ token: null });
  },
}));
