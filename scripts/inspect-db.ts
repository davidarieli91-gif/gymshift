import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const main = async () => {
  const trainers = await db.trainer.findMany({ select: { id: true, name: true, role: true, color: true, phone: true }, orderBy: { createdAt: "asc" } });
  console.log(JSON.stringify(trainers));
  console.log("templateSlots:", await db.templateSlot.count());
  console.log("shifts:", await db.shift.count());
  const slots = await db.templateSlot.findMany({ orderBy: [{ weekday: "asc" }, { startMin: "asc" }] });
  console.log(slots.map(s => `${s.weekday} ${s.startMin}-${s.endMin}`).join(" | "));
};
main().finally(() => db.$disconnect());
