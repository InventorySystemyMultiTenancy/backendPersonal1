DO $$
BEGIN
  CREATE TYPE "EventParticipantStatus" AS ENUM ('PENDING', 'GOING', 'NOT_GOING');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public."PersonalEvent" (
  "id" UUID PRIMARY KEY,
  "personalId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NULL,
  "location" TEXT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PersonalEvent_personalId_fkey"
    FOREIGN KEY ("personalId") REFERENCES public."PersonalProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS public."PersonalEventParticipant" (
  "id" UUID PRIMARY KEY,
  "personalId" UUID NOT NULL,
  "eventId" UUID NOT NULL,
  "alunoId" UUID NOT NULL,
  "status" "EventParticipantStatus" NOT NULL DEFAULT 'PENDING',
  "respondedAt" TIMESTAMP(3) NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PersonalEventParticipant_personalId_fkey"
    FOREIGN KEY ("personalId") REFERENCES public."PersonalProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PersonalEventParticipant_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES public."PersonalEvent"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PersonalEventParticipant_alunoId_fkey"
    FOREIGN KEY ("alunoId") REFERENCES public."Aluno"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PersonalEventParticipant_eventId_alunoId_key"
  ON public."PersonalEventParticipant"("eventId", "alunoId");
CREATE INDEX IF NOT EXISTS "PersonalEvent_personalId_idx" ON public."PersonalEvent"("personalId");
CREATE INDEX IF NOT EXISTS "PersonalEvent_startsAt_idx" ON public."PersonalEvent"("startsAt");
CREATE INDEX IF NOT EXISTS "PersonalEventParticipant_personalId_idx" ON public."PersonalEventParticipant"("personalId");
CREATE INDEX IF NOT EXISTS "PersonalEventParticipant_eventId_idx" ON public."PersonalEventParticipant"("eventId");
CREATE INDEX IF NOT EXISTS "PersonalEventParticipant_alunoId_idx" ON public."PersonalEventParticipant"("alunoId");
CREATE INDEX IF NOT EXISTS "PersonalEventParticipant_status_idx" ON public."PersonalEventParticipant"("status");
