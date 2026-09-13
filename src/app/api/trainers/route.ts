import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPin, jsonError, requireTrainer } from "@/lib/auth";
import { broadcast } from "@/lib/emit";
import { TRAINER_COLORS } from "@/lib/constants";
import { logChange, normalizePhone, publicTrainer } from "../_helpers";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  name: z.string().trim().min(2).max(40),
  pin: z.string().regex(/^\d{4,8}$/),
  phone: z.string().optional(),
});

/** GET /api/trainers (auth) -> {trainers:[... + shiftsCount, templateCount]} sorted by createdAt.
 *  personalCount (личный календарь) is included for ADMINS only — it feeds the
 *  delete-confirmation cascade warning; regular trainers never see it. */
export async function GET(req: NextRequest) {
  const actor = await requireTrainer(req);
  if (!actor) return jsonError("unauthorized", 401);

  const trainers = await db.trainer.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: {
          shifts: true,
          templateSlots: true,
          ...(actor.role === "admin" ? { personalEvents: true } : {}),
        },
      },
    },
  });

  return NextResponse.json({
    trainers: trainers.map((t) => ({
      ...publicTrainer(t),
      shiftsCount: t._count.shifts,
      templateCount: t._count.templateSlots,
      ...(actor.role === "admin" ? { personalCount: t._count.personalEvents } : {}),
    })),
  });
}

/**
 * POST /api/trainers (admin only) {name, pin, phone?} -> {trainer}
 * Admin adds a trainer directly: no self-registration needed.
 * Role is always "trainer"; color auto-assigned; feeds «Все тренера» instantly.
 */
export async function POST(req: NextRequest) {
  const actor = await requireTrainer(req);
  if (!actor) return jsonError("unauthorized", 401);
  if (actor.role !== "admin") return jsonError("forbidden", 403);

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
  const clash = trainers.find((t) => t.name.toLowerCase() === name.toLowerCase());
  if (clash) return jsonError("name_taken", 409);

  const color = TRAINER_COLORS[trainers.length % TRAINER_COLORS.length];
  const phone = normalizePhone(parsed.data.phone);

  const trainer = await db.trainer.create({
    data: { name, phone, pinHash: hashPin(pin), role: "trainer", color },
  });

  await logChange(
    { id: actor.id, name: actor.name },
    "trainer_add",
    { trainerName: trainer.name },
  );
  await broadcast("trainers:changed");

  return NextResponse.json({ trainer: publicTrainer(trainer) });
}
