import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPin, jsonError, requireTrainer } from "@/lib/auth";
import { broadcast } from "@/lib/emit";
import { logChange, normalizePhone, publicTrainer } from "../../_helpers";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  phone: z.string().optional(),
  pin: z.string().optional(),
  role: z.string().optional(),
});

/**
 * PATCH /api/trainers/:id
 *  - self may update {phone?, pin?}
 *  - admin may update {role?} of others (never own role)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await requireTrainer(req);
  if (!actor) return jsonError("unauthorized", 401);

  const { id } = await params;
  const target = await db.trainer.findUnique({ where: { id } });
  if (!target) return jsonError("not_found", 404);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("bad_request", 400);
  }
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) return jsonError("bad_request", 400);
  const { phone, pin, role } = parsed.data;
  if (phone === undefined && pin === undefined && role === undefined) {
    return jsonError("bad_request", 400);
  }

  const isSelf = target.id === actor.id;
  const isAdmin = actor.role === "admin";
  const data: { phone?: string | null; pinHash?: string; role?: string } = {};

  if (phone !== undefined || pin !== undefined) {
    if (!isSelf) return jsonError("forbidden", 403);
    if (phone !== undefined) data.phone = normalizePhone(phone);
    if (pin !== undefined) {
      if (!/^\d{4,8}$/.test(pin)) return jsonError("bad_request", 400);
      data.pinHash = hashPin(pin);
    }
  }

  if (role !== undefined) {
    if (!isAdmin) return jsonError("forbidden", 403);
    if (isSelf) return jsonError("forbidden", 403); // cannot change own role
    if (role !== "admin" && role !== "trainer") {
      return jsonError("bad_request", 400);
    }
    data.role = role;
  }

  const updated = await db.trainer.update({ where: { id: target.id }, data });
  await broadcast("trainers:changed");

  return NextResponse.json({ trainer: publicTrainer(updated) });
}

/**
 * DELETE /api/trainers/:id — admin only, never self.
 * Shifts and template slots cascade (schema onDelete: Cascade).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await requireTrainer(req);
  if (!actor) return jsonError("unauthorized", 401);
  if (actor.role !== "admin") return jsonError("forbidden", 403);

  const { id } = await params;
  if (id === actor.id) return jsonError("forbidden", 403);

  const target = await db.trainer.findUnique({ where: { id } });
  if (!target) return jsonError("not_found", 404);

  await db.trainer.delete({ where: { id } }); // cascades shifts + templateSlots

  await logChange(
    { id: actor.id, name: actor.name },
    "trainer_remove",
    { trainerName: target.name },
  );
  // the cascade removed this trainer's shifts and template slots too —
  // every open client must refresh those datasets as well
  await broadcast("trainers:changed");
  await broadcast("shifts:changed");
  await broadcast("template:changed");

  return NextResponse.json({ ok: true });
}
