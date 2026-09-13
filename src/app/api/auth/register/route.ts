import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPin, jsonError, makeToken } from "@/lib/auth";
import { broadcast } from "@/lib/emit";
import { TRAINER_COLORS } from "@/lib/constants";
import { logChange, normalizePhone, publicTrainer } from "../../_helpers";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  name: z.string().trim().min(2).max(40),
  pin: z.string().regex(/^\d{4,8}$/),
  phone: z.string().optional(),
});

/**
 * POST /api/auth/register {name, pin, phone?} -> {token, trainer}
 * The FIRST account while no admin exists becomes role "admin".
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

  const trainers = await db.trainer.findMany();
  const clash = trainers.find(
    (t) => t.name.toLowerCase() === name.toLowerCase(),
  );
  if (clash) return jsonError("name_taken", 409);

  const role = trainers.some((t) => t.role === "admin") ? "trainer" : "admin";
  const color = TRAINER_COLORS[trainers.length % TRAINER_COLORS.length];
  const phone = normalizePhone(parsed.data.phone);

  const trainer = await db.trainer.create({
    data: { name, phone, pinHash: hashPin(pin), role, color },
  });

  await logChange({ id: trainer.id, name: trainer.name }, "trainer_join", {});
  await broadcast("trainers:changed");

  return NextResponse.json({
    token: makeToken(trainer.id, trainer.pinHash),
    trainer: publicTrainer(trainer),
  });
}
