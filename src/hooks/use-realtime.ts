"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

export interface RealtimeHandlers {
  onShiftsChanged: () => void;
  onTemplateChanged: () => void;
  onTrainersChanged: () => void;
  onChangesNew: () => void;
}

/**
 * Socket.io realtime connection (via gateway: never a port in the URL).
 * Returns the current connection status — when false, callers poll instead.
 *
 * On Vercel there is no realtime service: set NEXT_PUBLIC_REALTIME=off in the
 * project env — the socket is never created (no wasted handshakes) and the
 * 15-second polling fallback drives all updates.
 */
export function useRealtime(enabled: boolean, handlers: RealtimeHandlers): boolean {
  const [connected, setConnected] = useState(false);
  // keep handlers fresh without reconnecting on every render
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    if (!enabled) return;
    if (process.env.NEXT_PUBLIC_REALTIME === "off") return;

    const socket: Socket = io("/?XTransformPort=3003", {
      transports: ["websocket", "polling"],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onConnectError = () => setConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);

    socket.on("shifts:changed", () => ref.current.onShiftsChanged());
    socket.on("template:changed", () => ref.current.onTemplateChanged());
    socket.on("trainers:changed", () => ref.current.onTrainersChanged());
    socket.on("changes:new", () => ref.current.onChangesNew());

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      setConnected(false);
    };
  }, [enabled]);

  return connected;
}
