# GymShift — SPEC v1 (implementation contract)

Online shift calendar for a gym. Shared by 5–10 trainers. Everyone sees changes
instantly, everyone can edit. Senior admin (first registered account without an
admin) manages the standard weekly template. Languages: RU + HE (RTL). 10 themes.
PWA (installable). Mobile-first. Week starts on SUNDAY (Israel standard).

## Product decisions (confirmed by the customer)

- Shifts ONLY — no class types, no workout names. A shift = trainer + date + time range.
- Working windows: Sun–Thu 07:30–22:30, Fri–Sat 09:00–17:00 (see `src/lib/constants.ts`).
- "Standard shifts" weekly template + button «Посмотреть стандартные смены тренеров»
  in the header (everyone can view; only admin edits / applies to a week).
- Changes are visible immediately (socket.io realtime + polling fallback) and are
  fixed in the "Recent changes" feed.
- Every change can be sent to a trainer's smartphone via WhatsApp (wa.me deep link,
  trainer phone is optional at registration).
- Registration without email: name + 4–8 digit PIN + optional phone. Shared link →
  register → work. First registered account becomes `admin` if no admin exists yet.
- PWA: installable on smartphone/desktop ("Установить приложение").
- Mobile-first, then desktop. Sticky footer. No blue/indigo primary (teal/emerald ok).

## What already exists (design prototype from task 1 — rework it, don't rewrite from scratch)

- `src/lib/{types,i18n,format,themes,mock-data}.ts`, `src/lib/constants.ts` (SHARED, do not edit without reading),
- `src/components/calendar/*` (header-bar, theme-menu, view-switcher, calendar-toolbar,
  multi-day-grid, month-grid, shift-block, shift-dialog, activity-panel, invite-popover, trainer-avatar),
- `src/app/page.tsx` (local-state prototype with mock data + localStorage),
- 10 themes in `src/app/globals.css` via `[data-theme=...]`, fonts Inter+Heebo in layout.tsx,
- Prisma schema ALREADY pushed and seeded (demo PIN for all seeded trainers: `1234`).

## Domain (Prisma models — already in DB, DO NOT change schema)

- `Trainer {id, name(unique), phone?, pinHash, role:"admin"|"trainer", color, createdAt}`
- `Shift {id, date:"yyyy-mm-dd", trainerId, startMin, endMin, note?, createdById, createdAt, updatedAt}`
- `TemplateSlot {id, weekday:0=Sun..6=Sat, trainerId, startMin, endMin}`
- `ChangeLog {id, actorId, actorName, action, payload:JSON-string, createdAt}`

Minutes-from-midnight: 450 = 07:30, 1350 = 22:30, 540 = 09:00, 1020 = 17:00.

## Auth scheme (exact, backend implements; frontend just stores the token)

- PIN hash: `sha256("gymshift:" + pin)` hex. SECRET = `process.env.AUTH_SECRET ?? "gymshift-secret-v1"`.
- Token sent by client in header: `Authorization: Bearer <token>`.
- Token format: `${trainerId}.${sha256hex(trainerId + ":" + pinHash + ":" + SECRET)}`.
- Verify: parse id, load trainer, recompute signature, compare (timingSafeEqual).
- localStorage keys: `gs-token` (token), `gs-theme`, `gs-lang` already used by prototype.

## REST API contract (all JSON; errors: `{ "error": "<code>" }` + proper HTTP status)

Auth codes: `bad_request`(400), `name_taken`(409), `invalid`(401), `forbidden`(403),
`not_found`(404), `window`(400 — outside working window), `overlap`(409 — same trainer
already has an overlapping shift that date), `unauthorized`(401).

| Method & path | Body / query | Response |
|---|---|---|
| GET `/api` | — | `{ok:true,service:"gymshift"}` (health) |
| POST `/api/auth/register` | `{name, pin, phone?}` | `{token, trainer}` |
| POST `/api/auth/login` | `{name, pin}` | `{token, trainer}` |
| GET `/api/auth/me` | auth | `{trainer}` |
| GET `/api/trainers` | auth | `{trainers:[{id,name,phone,color,role}]}` |
| PATCH `/api/trainers/:id` | auth; self:`{phone?,pin?}` admin:`{role?}` | `{trainer}` |
| DELETE `/api/trainers/:id` | admin, not self | `{ok:true}` (cascades shifts) |
| GET `/api/shifts` | auth; `?from=yyyy-mm-dd&to=yyyy-mm-dd` | `{shifts:[{id,date,trainerId,startMin,endMin,note,trainer:{id,name,color}}]}` sorted by date,startMin |
| POST `/api/shifts` | auth; `{date,trainerId,startMin,endMin,note?}` | `{shift}` (shape as above) |
| PUT `/api/shifts/:id` | auth; `{trainerId?,startMin?,endMin?,note?}` (date immutable) | `{shift}` |
| DELETE `/api/shifts/:id` | auth | `{ok:true}` |
| GET `/api/template` | auth | `{slots:[{id,weekday,trainerId,startMin,endMin,trainer:{name,color}}]}` sorted weekday,startMin |
| PUT `/api/template` | admin; `{slots:[{weekday,trainerId,startMin,endMin}]}` (replaces ALL) | `{slots}` |
| POST `/api/template/apply` | admin; `{from:"yyyy-mm-dd"}` (must be a Sunday) | `{created:n}` — deletes that week's shifts (from..from+6) and inserts template |
| GET `/api/changes` | auth; `?limit=50` | `{changes:[{id,actorId,actorName,action,payload(object),createdAt(ISO)}]}` newest first |

`trainer` object everywhere = `{id,name,phone,color,role}` (NEVER pinHash).

Validation rules:
- register: name trimmed 2–40 chars (unique case-insensitive), pin `/^\d{4,8}$/`,
  phone optional, normalize to digits only (strip spaces/dashes/parentheses).
- shift date must match `/^\d{4}-\d{2}-\d{2}$/`; weekday from LOCAL date (construct
  `new Date(y, m-1, d)`); window check against `DAY_WINDOWS[weekday]`;
  `startMin < endMin`; both inside window. Overlap: same trainerId+date where
  `existing.startMin < newEnd && existing.endMin > newStart` (exclude self on update).
- template/apply: validate every slot against its weekday window.

ChangeLog `action` values and `payload` (JSON, all times "HH:MM"):
- `shift_add` / `shift_edit` / `shift_delete`: `{date, trainerName, start, end, oldStart?, oldEnd?, note?}`
- `template_save`: `{count}` ; `template_apply`: `{from, to, count}`
- `trainer_join`: `{}` ; `trainer_remove`: `{trainerName}`

Next.js 16 note: dynamic route params are a Promise — `{ params }: { params: Promise<{id:string}> }`, `const { id } = await params;`

## Realtime (socket.io mini-service on port 3003)

Server: `mini-services/realtime-service/` — own bun project:
- `package.json`: `{ "name":"realtime-service", "scripts": { "dev": "bun --hot index.ts" } }`,
  run `bun add socket.io` INSIDE that folder (do not touch the root package.json).
- `index.ts`: http server + `new Server(httpServer, { path: "/", cors: {origin:"*",methods:["GET","POST"]} , pingTimeout:60000, pingInterval:25000 })`, listen **3003** (hardcoded).
- `GET /health` → `{ok:true}`.
- `POST /emit` → header `x-internal-key: gymshift-internal-2026` else 401; JSON body
  `{name: string, data?: unknown}` → `io.emit(name, data)` → `{ok:true}`.
  (Parse JSON body manually from the http request — no frameworks.)

Backend helper `src/lib/emit.ts` (backend-owned):
```ts
export async function broadcast(name: string, data?: unknown): Promise<void> {
  try {
    await fetch("http://127.0.0.1:3003/emit", {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-key": "gymshift-internal-2026" },
      body: JSON.stringify({ name, data }),
      signal: AbortSignal.timeout(800),
    });
  } catch { /* service may be down — never fail the API because of it */ }
}
```
Events emitted by the API after every mutation: `"shifts:changed"`, `"template:changed"`,
`"trainers:changed"`, `"changes:new"` (data = the new ChangeLog entry object).

Client connection (frontend):
```ts
const socket = io('/?XTransformPort=3003', {
  transports: ['websocket', 'polling'], forceNew: true,
  reconnection: true, reconnectionAttempts: 5, reconnectionDelay: 1000, timeout: 10000,
});
```
On any of the 4 events → invalidate the relevant TanStack Query caches. Expose
`connected` status (small green/gray dot near the logo in the header: «онлайн/офлайн»).
Fallback: when socket is NOT connected, poll queries every 15 s (`refetchInterval`).

## Frontend work (task 2-a) — detailed

Rework the existing prototype into the real app:

1. `src/lib/types.ts` — new types (Lang, ViewId, Role, Trainer, Shift with startMin/endMin,
   ChangeAction union, ChangeEntry, TemplateSlot). Delete `src/lib/mock-data.ts`.
2. `src/lib/api.ts` — typed API client implementing the contract above
   (`ApiError {code}`; token from localStorage `gs-token`; on 401 → clear token).
3. `src/lib/i18n.ts` — update Dict: REMOVE types/typesShort; ADD auth screen strings,
   template dialog strings, user menu, profile dialog, WhatsApp strings, role names
   (`roles: {admin:"Старший админ", trainer:"Тренер"}` / he: «מנהל ראשי», «מאמן»),
   connection status, error-code map, window hint, footer autosave text. Full Hebrew translations!
4. `src/components/providers.tsx` — QueryClientProvider ("use client").
5. `src/components/auth/auth-screen.tsx` — full-screen auth: logo, tagline, Tabs
   Вход/Регистрация, name+pin (+phone optional on register, hint «для WhatsApp»),
   PIN confirm on register, error toasts, demo hint «Демо: Авива / PIN 1234».
6. `src/app/page.tsx` — auth gate (`me` query → AuthScreen or app), TanStack Query for
   shifts/trainers/changes/template, socket-driven invalidation, unread badge for the
   changes bell (entries newer than `gs-lastSeen` epoch; when panel opens → save now),
   keep existing view/anchor/theme/lang logic, sticky footer.
7. Header-bar: add «Стандартные смены» button (CalendarClock icon; opens template dialog),
   user avatar menu (name, role badge, «Мой профиль» dialog: phone + optional new PIN →
   PATCH, «Установить приложение» when canInstall, «Выйти»), online dot.
8. `src/components/calendar/template-dialog.tsx` — read-only view for trainers; for admin:
   per-day slot lists (chip: color dot, name, time, remove), add-slot controls (trainer
   Select + start/end Selects with 15-min steps inside the day window), «Сохранить шаблон»,
   «Применить к неделе…» with week navigation + AlertDialog confirm «заменит смены недели
   {range} на стандартные», POST /api/template/apply, toasts.
9. `activity-panel.tsx` — render ChangeEntry from payload (localized sentences), WhatsApp
   share per entry: Popover listing trainers WITH phone (wa.me/<digits>?text=<msg>) +
   «Другой чат…» (`https://wa.me/?text=`), message built by `buildChangeMessage(entry, lang)`;
   also a copy-text button. Date in message via Intl (ru-RU/he-IL).
10. `shift-dialog.tsx` — remove type field; trainer Select, date input, start/end Selects
    (15-min steps inside the window of the selected date — recompute when date changes),
    optional note; client-side validation + server error codes → localized messages.
11. `multi-day-grid.tsx` — minutes-based positioning; per-view union window of visible
    days (from DAY_WINDOWS); hour labels every 2 h; red «now» line; shift blocks colored
    by `shift.trainer.color`; note in popover.
12. `month-grid.tsx` — chips «Имя · HH:MM–HH:MM» with color dot; Fri/Sat tint; «+N ещё»
    switches to day view of that date.
13. `invite-popover.tsx` — copies `location.origin`; add WhatsApp share button for the link.
14. PWA: `public/manifest.webmanifest` (name «GymShift — Смены тренеров», short_name
    GymShift, start_url "/", display standalone, theme_color "#0d9488", background_color
    "#f6f8f6", icons: `/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/maskable-512.png`
    — icon FILES will be added later by the coordinator, just reference them), layout
    metadata: manifest + appleWebApp; `public/sw.js` (navigation/API network-first,
    static cache-first, skipWaiting, clientsClaim, offline fallback to cached "/");
    `src/components/pwa/service-worker-registrar.tsx` (register on mount, skip on localhost);
    `src/hooks/use-install-prompt.ts` (beforeinstallprompt → {canInstall, promptInstall}).
15. Footer texts → «данные сохраняются автоматически · онлайн» (+ connection dot).

Design quality bar (keep from prototype): mobile-first, shadcn/ui only, lucide icons,
framer-motion only for subtle transitions, logical CSS properties (ps-/pe-/ms-/me-,
start-/end-) so RTL works, long lists `max-h-96 overflow-y-auto` + `.scroll-slim`,
toasts via sonner, skeletons while loading, min 44 px touch targets.

## Backend work (task 2-b) — files you own

- `src/lib/auth.ts` (SECRET/hash/token/requireTrainer/jsonError + minToHHMM helper),
- `src/lib/emit.ts`, all `src/app/api/**` route handlers (rewrite `src/app/api/route.ts` as health),
- `mini-services/realtime-service/**` (own package.json; `bun add socket.io` inside; start with
  `cd mini-services/realtime-service && nohup bun run dev > service.log 2>&1 &`),
- Test every endpoint with curl (register → save token → use it), verify `/emit` returns ok,
  verify `dev.log` has no compile errors, run `bunx eslint src/app/api src/lib/auth.ts src/lib/emit.ts`.

## File ownership (PARALLEL AGENTS — do not cross these boundaries!)

- **2-a frontend owns**: `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`,
  `src/lib/{types,i18n,format,api,themes}.ts`, deleting `src/lib/mock-data.ts`,
  `src/components/**`, `src/hooks/**`, `public/manifest.webmanifest`, `public/sw.js`, `public/icons/**` (skip — coordinator adds).
- **2-b backend owns**: `prisma/seed.ts` (if re-run needed), `src/lib/{auth,emit}.ts`,
  `src/app/api/**`, `mini-services/**`. Do NOT touch page/layout/globals/components.
- **Shared, edit only if a contract bug is proven**: `src/lib/constants.ts`, `src/lib/types.ts`
  (2-a owns types; 2-b must not import it — define response shapes locally).
- Nobody edits `prisma/schema.prisma`. Nobody runs `bun run build` or restarts the dev server.
- Root deps are installed already (socket.io-client, @tanstack/react-query, zustand, sonner...).
  Do NOT run `bun add` in the root. Only the realtime-service folder gets its own install.

## Worklog protocol (mandatory)

Before working: read `/home/z/my-project/worklog.md`. After finishing: append (shell append,
`cat >> /home/z/my-project/worklog.md << 'EOF' ... EOF`) a section starting with `---`,
then `Task ID: <id>`, `Agent: <name>`, `Task: <...>`, `Work Log:` bullets, `Stage Summary:` bullets.
