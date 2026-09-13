/**
 * GymShift backend auth (see SPEC.md "Auth scheme"):
 *   pinHash = sha256("gymshift:" + pin) hex
 *   token   = `${trainerId}.${sha256hex(trainerId + ":" + pinHash + ":" + SECRET)}`
 *   header  = "Authorization: Bearer <token>"
 */
import { createHash, timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "./db";

export const SECRET: string = process.env.AUTH_SECRET ?? "gymshift-secret-v1";

/** sha256("gymshift:" + pin) as hex. Same scheme as prisma/seed.ts. */
export function hashPin(pin: string): string {
  return createHash("sha256").update(`gymshift:${pin}`).digest("hex");
}

/** Recompute the token signature for a trainer. */
function signature(trainerId: string, pinHash: string): string {
  return createHash("sha256")
    .update(`${trainerId}:${pinHash}:${SECRET}`)
    .digest("hex");
}

/** Timing-safe comparison of two strings of the same encoding. */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Build a bearer token for a trainer. */
export function makeToken(trainerId: string, pinHash: string): string {
  return `${trainerId}.${signature(trainerId, pinHash)}`;
}

/** Trainer row shape returned by requireTrainer (full row incl. pinHash — never serialize it to clients). */
export type TrainerRow = {
  id: string;
  name: string;
  phone: string | null;
  pinHash: string;
  role: string;
  color: string;
  createdAt: Date;
};

/**
 * Resolve the trainer from the Authorization header.
 * Returns null when the header is missing/malformed or the token/signature is invalid.
 */
export async function requireTrainer(
  req: NextRequest,
): Promise<TrainerRow | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;

  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const trainerId = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const trainer = await db.trainer.findUnique({ where: { id: trainerId } });
  if (!trainer) return null;

  if (!safeEqual(sig, signature(trainer.id, trainer.pinHash))) return null;
  return trainer;
}

/** `{ "error": "<code>" }` JSON response with the given HTTP status. */
export function jsonError(code: string, status: number): NextResponse {
  return NextResponse.json({ error: code }, { status });
}

/** 450 -> "07:30" (minutes-from-midnight to HH:MM, used in ChangeLog payloads). */
export function minToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
