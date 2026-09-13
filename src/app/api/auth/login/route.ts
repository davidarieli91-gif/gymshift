import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPin, jsonError, makeToken } from "@/lib/auth";
import { publicTrainer } from "../../_helpers";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  name: z.string().trim().min(1),
  pin: z.string().min(1),
});

/**
 * POST /api/auth/login {name, pin} -> {token, trainer} | 401 {error:"invalid"}
 * Name lookup is case-insensitive.
 */
export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("bad_request", 400);
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return jsonError("bad_request", 400);
  const { name, pin } = parsed.data;

  let trainer = await db.trainer.findUnique({ where: { name } });
  if (!trainer) {
    const all = await db.trainer.findMany();
    const lower = name.toLowerCase();
    trainer = all.find((t) => t.name.toLowerCase() === lower) ?? null;
  }

  if (!trainer || trainer.pinHash !== hashPin(pin)) {
    return jsonError("invalid", 401);
  }

  return NextResponse.json({
    token: makeToken(trainer.id, trainer.pinHash),
    trainer: publicTrainer(trainer),
  });
}
