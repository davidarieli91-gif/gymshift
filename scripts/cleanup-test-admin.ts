// One-off cleanup: remove the verification test admin, then report state.
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const del = await db.trainer.deleteMany({ where: { name: "Директор Зала" } });
  const cl = await db.changeLog.deleteMany({ where: { actorName: "Директор Зала" } });
  const admins = await db.trainer.count({ where: { role: "admin" } });
  const trainers = await db.trainer.count();
  console.log(
    `cleanup: removed ${del.count} test trainer(s), ${cl.count} log entries; admins now: ${admins}, trainers: ${trainers}`,
  );
}

main().finally(() => db.$disconnect());
