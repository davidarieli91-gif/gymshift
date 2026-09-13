-- CreateTable
CREATE TABLE "Trainer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "pinHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'trainer',
    "color" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Shift_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "Trainer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TemplateSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekday" INTEGER NOT NULL,
    "trainerId" TEXT NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,
    CONSTRAINT "TemplateSlot_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "Trainer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PersonalEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trainerId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "color" TEXT,
    "repeat" TEXT NOT NULL DEFAULT 'none',
    "exceptions" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PersonalEvent_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "Trainer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChangeLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Trainer_name_key" ON "Trainer"("name");

-- CreateIndex
CREATE INDEX "Shift_date_idx" ON "Shift"("date");

-- CreateIndex
CREATE INDEX "PersonalEvent_trainerId_date_idx" ON "PersonalEvent"("trainerId", "date");

-- CreateIndex
CREATE INDEX "ChangeLog_createdAt_idx" ON "ChangeLog"("createdAt");

