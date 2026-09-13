/**
 * One-off migration (Task 5): switch the standard-shifts template to the new
 * gym structure — Sun–Thu 3 shifts (07:30–12:00, 12:00–17:00, 17:00–22:30),
 * Fri 2 shifts (09:00–13:00, 13:00–17:00), Sat (Shabbat) 1 shift (08:00–17:00).
 *
 * Replaces ALL TemplateSlot rows and re-applies the template to the CURRENT and
 * NEXT week (Asia/Jerusalem). Past weeks, trainers, changelog are untouched.
 * Run: bun scripts/update-template.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const ROTATION: Record<number, [string, number, number][]> = {
  0: [
    ["Авива", 450, 720],
    ["Игорь", 720, 1020],
    ["Марина", 1020, 1350],
  ],
  1: [
    ["Йоси", 450, 720],
    ["Авива", 720, 1020],
    ["Игорь", 1020, 1350],
  ],
  2: [
    ["Марина", 450, 720],
    ["Йоси", 720, 1020],
    ["Авива", 1020, 1350],
  ],
  3: [
    ["Игорь", 450, 720],
    ["Марина", 720, 1020],
    ["Йоси", 1020, 1350],
  ],
  4: [
    ["Авива", 450, 720],
    ["Игорь", 720, 1020],
    ["Марина", 1020, 1350],
  ],
  5: [
    ["Игорь", 540, 780],
    ["Марина", 780, 1020],
  ],
  6: [["Авива", 480, 1020]],
};

const p = (n: number) => String(n).padStart(2, "0");

function todayIL(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
}

function weekdayOf(ds: string): number {
  const [y, m, d] = ds.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

function shiftDate(ds: string, days: number): string {
  const [y, m, d] = ds.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

async function main() {
  const trainers = await db.trainer.findMany();
  const byName = new Map(trainers.map((t) => [t.name, t]));

  // 1) replace the template with the new standard structure
  await db.templateSlot.deleteMany();
  let slots = 0;
  for (const [wd, defs] of Object.entries(ROTATION)) {
    for (const [name, startMin, endMin] of defs) {
      const tr = byName.get(name);
      if (!tr) throw new Error(`trainer ${name} missing`);
      await db.templateSlot.create({
        data: { weekday: Number(wd), trainerId: tr.id, startMin, endMin },
      });
      slots++;
    }
  }
  console.log(`Template replaced: ${slots} slots (new structure).`);

  // 2) re-apply the template to the current and next week
  const today = todayIL();
  const weeks = [shiftDate(today, -weekdayOf(today)), shiftDate(today, -weekdayOf(today) + 7)];
  for (const from of weeks) {
    const to = shiftDate(from, 6);
    await db.shift.deleteMany({ where: { date: { gte: from, lte: to } } });
    let created = 0;
    for (let i = 0; i < 7; i++) {
      const ds = shiftDate(from, i);
      const wd = weekdayOf(ds);
      for (const [name, startMin, endMin] of ROTATION[wd]) {
        const tr = byName.get(name);
        if (!tr) throw new Error(`trainer ${name} missing`);
        await db.shift.create({
          data: { date: ds, trainerId: tr.id, startMin, endMin, createdById: tr.id },
        });
        created++;
      }
    }
    console.log(`Week ${from}..${to}: ${created} shifts re-applied.`);
  }

  console.log(`Total shifts now: ${await db.shift.count()}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
