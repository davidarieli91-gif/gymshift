/**
 * Fire-and-forget broadcast to the realtime mini-service (socket.io, port 3003).
 * Never fails the API: any error (service down, timeout) is swallowed.
 *
 * On Vercel there is no local realtime service: set REALTIME_DISABLED=1 in the
 * project env — the broadcast becomes a no-op and clients rely on polling.
 */
export async function broadcast(name: string, data?: unknown): Promise<void> {
  if (process.env.REALTIME_DISABLED === "1") return;
  try {
    await fetch("http://127.0.0.1:3003/emit", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-key": "gymshift-internal-2026",
      },
      body: JSON.stringify({ name, data }),
      signal: AbortSignal.timeout(800),
    });
  } catch {
    /* service may be down — never fail the API because of it */
  }
}
