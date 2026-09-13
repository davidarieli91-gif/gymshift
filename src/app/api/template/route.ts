import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { jsonError, requireTrainer } from "@/lib/auth";
import { broadcast } from "@/lib/emit";
import { inWindowWeekday, logChange } from "../_helpers";

export const dynamic = "force-dynamic";

const slotSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  trainerId: z.string().min(1),
  startMin: z.number().int().min(0).max(1440),
  endMin: z.number().int().min(0).max(1440),
});

const putSchema = z.object({ slots: z.array(slotSchema) });

function slotShape(
  s: Prisma.TemplateSlotGetPayload<{ include: { trainer: { select: { name: true; color: true } } } }>,
) {
  return {
    id: s.id,
    weekday: s.weekday,
    trainerId: s.trainerId,
    startMin: s.startMin,
    endMin: s.endMin,
    trainer: { name: s.trainer.name, color: s.trainer.color },
  };
}

const slotsQuery = {
  orderBy: [{ weekday: "asc" }, { startMin: "asc" }],
  include: { trainer: { select: { name: true, color: true } } },
} satisfies Prisma.TemplateSlotFindManyArgs;

/** GET /api/template (auth) -> {slots:[...]} sorted weekday, startMin. */
export async function GET(req: NextRequest) {
  const actor = await requireTrainer(req);
  if (!actor) return jsonError("unauthorized", 401);

  const slots = await db.templateSlot.findMany(slotsQuery);
  return NextResponse.json({ slots: slots.map(slotShape) });
}

/**
 * PUT /api/template (admin only) {slots:[{weekday,trainerId,startMin,endMin}]}
 * Replaces ALL slots in a transaction -> {slots} | 403 {error:"forbidden"} | 400 window
 */
export async function PUT(req: NextRequest) {
  const actor = await requireTrainer(req);
  if (!actor) return jsonError("unauthorized", 401);
  if (actor.role !== "admin") return jsonError("forbidden", 403);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("bad_request", 400);
  }
  const parsed = putSchema.safeParse(raw);
  if (!parsed.success) return jsonError("bad_request", 400);

  const trainerIds = new Set(
    (await db.trainer.findMany({ select: { id: true } })).map((t) => t.id),
  );
  for (const slot of parsed.data.slots) {
    if (!trainerIds.has(slot.trainerId)) return jsonError("bad_request", 400);
    if (!inWindowWeekday(slot.weekday, slot.startMin, slot.endMin)) {
      return jsonError("window", 400);
    }
  }

  const slots = await db.$transaction(async (tx) => {
    await tx.templateSlot.deleteMany();
    if (parsed.data.slots.length > 0) {
      await tx.templateSlot.createMany({ data: parsed.data.slots });
    }
    return tx.templateSlot.findMany(slotsQuery);
  });

  await logChange(
    { id: actor.id, name: actor.name },
    "template_save",
    { count: parsed.data.slots.length },
  );
  await broadcast("template:changed");

  return NextResponse.json({ slots: slots.map(slotShape) });
}
