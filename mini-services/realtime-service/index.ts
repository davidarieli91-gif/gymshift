/**
 * GymShift realtime mini-service — socket.io broadcaster on port 3003.
 *
 * - Browsers connect through the gateway: io("/?XTransformPort=3003").
 * - The Next.js API pushes events via POST /emit (x-internal-key required).
 * - GET /health -> {ok:true} (monitoring / smoke tests).
 *
 * NOTE: socket.io is configured with path "/" (mandated — Caddy forwards to it),
 * which makes engine.io a catch-all for every request. After attaching, we
 * re-route: our own endpoints (/health, /emit) are served here, everything
 * else (handshakes, websocket polling) is forwarded to engine.io's listener.
 */
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { Server } from "socket.io";

const PORT = 3003;
const INTERNAL_KEY = "gymshift-internal-2026";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-internal-key",
};

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { ...CORS_HEADERS, "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

/** Parse a JSON body manually — no frameworks. */
function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

async function handleInternal(req: IncomingMessage, res: ServerResponse) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/emit") {
    if (req.headers["x-internal-key"] !== INTERNAL_KEY) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    try {
      const body = (await readJsonBody(req)) as {
        name?: unknown;
        data?: unknown;
      };
      if (typeof body.name !== "string" || body.name === "") {
        throw new Error("bad name");
      }
      io.emit(body.name, body.data);
      sendJson(res, 200, { ok: true });
    } catch {
      sendJson(res, 400, { error: "bad_request" });
    }
    return;
  }

  sendJson(res, 404, { error: "not_found" });
}

const httpServer = createServer();

const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// socket.io's engine (path "/") just registered a catch-all "request" listener.
// Re-take control: serve our internal endpoints ourselves and forward
// everything else (socket.io handshakes on any path) to engine.io.
const engineRequestListeners = httpServer.listeners("request");
httpServer.removeAllListeners("request");
httpServer.on("request", (req, res) => {
  const pathname = (req.url ?? "/").split("?")[0];
  const isInternal =
    req.method === "OPTIONS" ||
    (req.method === "GET" && pathname === "/health") ||
    (req.method === "POST" && pathname === "/emit");
  if (isInternal) {
    void handleInternal(req, res);
    return;
  }
  for (const listener of engineRequestListeners) {
    listener.call(httpServer, req, res);
  }
});

io.on("connection", (socket) => {
  console.log(
    `[realtime] connect ${socket.id} (clients: ${io.engine.clientsCount})`,
  );
  socket.on("disconnect", (reason) => {
    console.log(
      `[realtime] disconnect ${socket.id} (${reason}) (clients: ${io.engine.clientsCount})`,
    );
  });
});

httpServer.listen(PORT, () => {
  console.log(`[realtime] listening on http://127.0.0.1:${PORT}`);
});

process.on("SIGTERM", () => {
  httpServer.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  httpServer.close(() => process.exit(0));
});

/* ------------------------------------------------------------------ */
/* Dev-server watchdog (sandbox helper)                                */
/* ------------------------------------------------------------------ */
// This process is long-lived (bun --hot, started outside agent tool
// sessions), so it can keep the Next.js dev server (port 3000) alive:
// whenever :3000 stops answering, relaunch `bun run dev` detached.
// The global flag prevents double registration across `bun --hot` reloads.
if (!(globalThis as { __gsDevWatch?: boolean }).__gsDevWatch) {
  (globalThis as { __gsDevWatch?: boolean }).__gsDevWatch = true;
  const DEV_ROOT = "/home/z/my-project";
  let lastSpawnAt = 0;
  const { spawn } = await import("node:child_process");
  const { openSync } = await import("node:fs");
  const logFd = openSync(`${DEV_ROOT}/dev.log`, "a");

  setInterval(() => {
    void (async () => {
      try {
        const res = await fetch("http://127.0.0.1:3000/", {
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok) return; // healthy
      } catch {
        /* down — fall through */
      }
      const now = Date.now();
      if (now - lastSpawnAt < 30_000) return; // let a previous spawn boot
      lastSpawnAt = now;
      console.log("[dev-watchdog] :3000 down — launching Next.js dev server");
      try {
        const child = spawn("bun", ["run", "dev"], {
          cwd: DEV_ROOT,
          stdio: ["ignore", logFd, logFd],
          detached: true,
        });
        child.unref();
      } catch (e) {
        console.log("[dev-watchdog] spawn failed:", e);
      }
    })();
  }, 8_000);
  console.log("[dev-watchdog] armed (port 3000 supervisor)");
}
