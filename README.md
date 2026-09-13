# GymShift — календарь смен для тренеров

Онлайн-табло смен спортзала: администратор и тренеры видят расписание,
перетаскиванием меняют смены местами, а «Последние изменения» показывают,
кто и что поменял. Работает на телефоне (PWA — ставится на главный экран),
на русском и иврите (с RTL), 10 цветовых тем.

## Возможности

- Календарь с видами: день / 3 дня / неделя / месяц
- Drag & drop: перенос смены, обмен двумя сменами (swap)
- Стандартные (повторяющиеся) недельные смены + применение на любую неделю
- Личный (приватный) календарь каждого тренера — виден только ему
- Лента «Последние изменения» + шеринг в WhatsApp
- Роли: **admin** (управляет составом тренеров) и **trainer**
- Вход по имени + PIN (без email), PIN хранится только как sha256-хэш
- Realtime через socket.io (self-host) или авто-обновление раз в 15 сек (Vercel)
- PWA, mobile-first, RU/HE (RTL), 10 тем

## Стек

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui ·
Prisma + SQLite/libSQL (локально — файл, в проде — [Turso](https://turso.tech)) ·
socket.io (опционально)

## Запуск локально

```bash
bun install
# .env: DATABASE_URL="file:./db/custom.db"
bun run db:push      # создать таблицы
bun prisma/seed.ts   # демо-тренеры + смены (PIN 1234)
bun run dev          # http://localhost:3000
```

## Деплой на Vercel + Turso

Пошаговая инструкция — в [DEPLOY.md](./DEPLOY.md) (бесплатные тарифы,
без платных подписок).

## Структура

```
src/app/            страницы и API-роуты (App Router)
src/components/     UI: календарь, диалоги, шапка (shadcn/ui)
src/lib/            auth, db (dual-mode sqlite/libsql), темы, i18n
prisma/             schema, сид, turso-schema.sql
mini-services/      realtime-сервис (socket.io) для self-host
public/             PWA: manifest, sw.js, иконки
```
