"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker on mount.
 * Skipped on localhost/127.0.0.1 so development is never cached.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") return;
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* offline support is best-effort */
      });
    };
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
