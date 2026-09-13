/**
 * GymShift seed: demo trainers + standard weekly template + shifts for
 * previous/current/next week (Israel timezone). Idempotent — safe to re-run.
 * Run: bun prisma/seed.ts
 */
import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";

const db = new PrismaClient();
const sha = (pin: string) =>
  createHash("sha256").update(`gymshift:${pin}`).digest("hex");

/** today in Asia/Jerusalem as "yyyy-mm-dd" */
function todayIL(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
  }).format(new Date());
}

/** weekday (0=Sun..6=Sat) of a "yyyy-mm-dd" string */
function weekdayOf(ds: string): number {
  const [y, m, d] = ds.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

function shiftDate(ds: string, days: number): string {
  const [y, m, d] = ds.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

const TRAINERS = [
  { name: "Авива", color: "#f59e0b" },
  { name: "Игорь", color: "#10b981" },
  { name: "Марина", color: "#8b5cf6" },
  { name: "Йоси", color: "#ec4899" },
];

// weekday -> [trainerName, startMin, endMin][]
// Standard structure: Sun–Thu 3 shifts (07:30–12:00, 12:00–17:00, 17:00–22:30),
// Fri 2 shifts (09:00–13:00, 13:00–17:00), Sat (Shabbat) 1 shift (08:00–17:00).
const TEMPLATE: Record<number, [string, number, number][]> = {
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

async function main() {
  const pinHash = sha("1234");

  const trainers: Record<string, { id: string; name: string; color: string }> = {};
  for (const t of TRAINERS) {
    const tr = await db.trainer.upsert({
      where: { name: t.name },
      update: { color: t.color },
      create: { name: t.name, color: t.color, pinHash, role: "trainer" },
    });
    trainers[t.name] = tr;
  }
  const byName = (n: string) => {
    const t = trainers[n];
    if (!t) throw new Error(`trainer ${n} missing`);
    return t;
  };

  // --- standard template (replace all) ---
  await db.templateSlot.deleteMany();
  for (const [wd, slots] of Object.entries(TEMPLATE)) {
    for (const [name, startMin, endMin] of slots) {
      await db.templateSlot.create({
        data: { weekday: Number(wd), trainerId: byName(name).id, startMin, endMin },
      });
    }
  }

  // --- shifts for -1 / current / +1 weeks from the template ---
  const today = todayIL();
  const from = shiftDate(today, -weekdayOf(today) - 7);
  const to = shiftDate(today, -weekdayOf(today) + 13);
  await db.shift.deleteMany({ where: { date: { gte: from, lte: to } } });
  let created = 0;
  for (let off = -7; off <= 13; off++) {
    const ds = shiftDate(today, off - weekdayOf(today));
    const wd = weekdayOf(ds);
    for (const [name, startMin, endMin] of TEMPLATE[wd]) {
      await db.shift.create({
        data: {
          date: ds,
          trainerId: byName(name).id,
          startMin,
          endMin,
          createdById: byName(name).id,
        },
      });
      created++;
    }
  }

  // --- a few changelog entries so the feed is not empty ---
  await db.changeLog.deleteMany();
  const now = Date.now();
  const rows = [
    {
      actorId: byName("Игорь").id,
      actorName: "Игорь",
      action: "shift_edit",
      payload: JSON.stringify({
        date: shiftDate(today, 1),
        trainerName: "Йоси",
        start: "15:00",
        end: "22:30",
        oldStart: "15:00",
        oldEnd: "22:30",
      }),
      ms: 6 * 60000,
    },
    {
      actorId: byName("Авива").id,
      actorName: "Авива",
      action: "shift_add",
      payload: JSON.stringify({
        date: shiftDate(today, 2),
        trainerName: "Марина",
        start: "07:30",
        end: "15:00",
      }),
      ms: 45 * 60000,
    },
    {
      actorId: byName("Марина").id,
      actorName: "Марина",
      action: "shift_delete",
      payload: JSON.stringify({
        date: shiftDate(today, -1),
        trainerName: "Игорь",
        start: "07:30",
        end: "15:00",
      }),
      ms: 3 * 3600000,
    },
    {
      actorId: byName("Авива").id,
      actorName: "Авива",
      action: "template_apply",
      payload: JSON.stringify({ from, to: shiftDate(today, -weekdayOf(today) + 6), count: 18 }),
      ms: 26 * 3600000,
    },
    {
      actorId: byName("Йоси").id,
      actorName: "Йоси",
      action: "trainer_join",
      payload: JSON.stringify({}),
      ms: 2 * 24 * 3600000,
    },
  ];
  for (const r of rows) {
    await db.changeLog.create({
      data: {
        actorId: r.actorId,
        actorName: r.actorName,
        action: r.action,
        payload: r.payload,
        createdAt: new Date(now - r.ms),
      },
    });
  }

  const trainerCount = await db.trainer.count();
  const shiftCount = await db.shift.count();
  const slotCount = await db.templateSlot.count();
  console.log(
    `Seed OK: ${trainerCount} trainers, ${shiftCount} shifts (${from}..${to}), ${slotCount} template slots, ${rows.length} changelog entries. Demo PIN: 1234`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
