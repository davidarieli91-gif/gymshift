import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

/**
 * Dual-mode database client:
 *
 * - LOCAL DEV (and this sandbox): DATABASE_URL = "file:..." → plain SQLite
 *   via the built-in Prisma engine, no extra config.
 *
 * - PRODUCTION (Vercel + Turso): DATABASE_URL = "libsql://....turso.io"
 *   (+ DATABASE_AUTH_TOKEN) → Prisma driver adapter for libSQL
 *   (the adapter builds its own @libsql/client from the config).
 *
 * If DATABASE_URL is missing entirely (e.g. a Vercel build without env vars
 * yet), we fall back to a placeholder file URL so that `next build` never
 * crashes at module-evaluation time — the first real query would fail loudly
 * instead, which is the desired behaviour.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const url = process.env.DATABASE_URL ?? "file:./db/placeholder.db";

function createPrismaClient(): PrismaClient {
  const log: Prisma.LogLevel[] = process.env.NODE_ENV === "production" ? [] : ["query"];

  if (url.startsWith("libsql:") || url.startsWith("http://") || url.startsWith("https://")) {
    // Turso / remote libSQL — driver adapter mode.
    // @prisma/adapter-libsql@6.x takes a Config object and builds its own
    // @libsql/client instance internally.
    return new PrismaClient({
      adapter: new PrismaLibSQL({ url, authToken: process.env.DATABASE_AUTH_TOKEN }),
      log,
    });
  }

  // Local SQLite file — default engine
  return new PrismaClient({ log });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
