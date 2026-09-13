import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError, requireTrainer } from "@/lib/auth";
import { broadcast } from "@/lib/emit";
import { dateAddDays, isDateStr, logChange, weekdayOf } from "../../_helpers";

export const dynamic = "force-dynamic";

const applySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * POST /api/template/apply (admin only) {from:"yyyy-mm-dd" — a Sunday}
 * Deletes that week's shifts (from..from+6) and inserts the template.
 * -> {created:n} | 403 {error:"forbidden"} | 400 bad_request
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
  const parsed = applySchema.safeParse(raw);
  if (!parsed.success) return jsonError("bad_request", 400);

  const { from } = parsed.data;
  if (!isDateStr(from)) return jsonError("bad_request", 400);
  if (weekdayOf(from) !== 0) return jsonError("bad_request", 400); // must be a Sunday

  const to = dateAddDays(from, 6);
  const slots = await db.templateSlot.findMany({ orderBy: { startMin: "asc" } });

  const created = await db.$transaction(async (tx) => {
    await tx.shift.deleteMany({ where: { date: { gte: from, lte: to } } });
    let n = 0;
    for (let off = 0; off < 7; off++) {
      const date = dateAddDays(from, off);
      const weekday = weekdayOf(date);
      for (const slot of slots.filter((s) => s.weekday === weekday)) {
        await tx.shift.create({
          data: {
            date,
            trainerId: slot.trainerId,
            startMin: slot.startMin,
            endMin: slot.endMin,
            createdById: actor.id,
          },
        });
        n++;
      }
    }
    return n;
  });

  await logChange(
    { id: actor.id, name: actor.name },
    "template_apply",
    { from, to, count: created },
  );
  await broadcast("shifts:changed");
  await broadcast("template:changed");

  return NextResponse.json({ created });
}
