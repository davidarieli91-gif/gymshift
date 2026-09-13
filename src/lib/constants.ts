// Shared constants for both frontend and backend (GymShift).

/**
 * Working window per weekday (minutes from midnight).
 * Sun–Thu (0–4): 07:30 – 22:30. Fri (5): 09:00 – 17:00. Sat (6): 08:00 – 17:00.
 */
export const DAY_WINDOWS: Record<number, { start: number; end: number }> = {
  0: { start: 450, end: 1350 },
  1: { start: 450, end: 1350 },
  2: { start: 450, end: 1350 },
  3: { start: 450, end: 1350 },
  4: { start: 450, end: 1350 },
  5: { start: 540, end: 1020 },
  6: { start: 480, end: 1020 },
};

/**
 * Standard daily shifts (the gym's default schedule) used for quick-add
 * presets in the template dialog:
 * - Sun–Thu: three shifts — 07:30–12:00, 12:00–17:00, 17:00–22:30;
 * - Fri: two shifts — 09:00–13:00, 13:00–17:00;
 * - Sat (Shabbat): one trainer from 08:00 — 08:00–17:00.
 */
export const STANDARD_SHIFTS: Record<number, Array<[number, number]>> = {
  0: [
    [450, 720],
    [720, 1020],
    [1020, 1350],
  ],
  1: [
    [450, 720],
    [720, 1020],
    [1020, 1350],
  ],
  2: [
    [450, 720],
    [720, 1020],
    [1020, 1350],
  ],
  3: [
    [450, 720],
    [720, 1020],
    [1020, 1350],
  ],
  4: [
    [450, 720],
    [720, 1020],
    [1020, 1350],
  ],
  5: [
    [540, 780],
    [780, 1020],
  ],
  6: [[480, 1020]],
};

/** Distinct colors auto-assigned to trainers on registration. */
export const TRAINER_COLORS: string[] = [
  "#f59e0b",
  "#10b981",
  "#8b5cf6",
  "#ec4899",
  "#0ea5e9",
  "#84cc16",
  "#f97316",
  "#14b8a6",
  "#a855f7",
  "#ef4444",
];

/**
 * Google-Calendar event palette (the 11 classic colors), used by the PRIVATE
 * personal calendar so every personal task / training can get its own color.
 * `null` color = "default" = the active theme's primary.
 */
export const EVENT_COLORS: Array<{ hex: string; ru: string; he: string }> = [
  { hex: "#d50000", ru: "Томатный", he: "עגבנייה" },
  { hex: "#e67c73", ru: "Фламинго", he: "פלמינגו" },
  { hex: "#f4511e", ru: "Мандарин", he: "טנג׳רין" },
  { hex: "#f6bf26", ru: "Банан", he: "בננה" },
  { hex: "#33b679", ru: "Шалфей", he: "מרווה" },
  { hex: "#0b8043", ru: "Базилик", he: "בזיליק" },
  { hex: "#039be5", ru: "Павлин", he: "טווס" },
  { hex: "#3f51b5", ru: "Голубика", he: "אוכמנית" },
  { hex: "#7986cb", ru: "Лаванда", he: "לבנדר" },
  { hex: "#8e24aa", ru: "Виноград", he: "ענבים" },
  { hex: "#616161", ru: "Графит", he: "גרפיט" },
];

/**
 * PIN hashing scheme (implemented server-side in src/lib/auth.ts):
 * sha256("gymshift:" + pin) as hex. The seed uses the same scheme.
 */
