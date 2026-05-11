-- Migration 015: Chat messages between personal trainer and aluno
CREATE TABLE IF NOT EXISTS "Message" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "personalId"  UUID         NOT NULL,
  "alunoId"     UUID         NOT NULL,
  "senderRole"  TEXT         NOT NULL CHECK ("senderRole" IN ('PERSONAL', 'ALUNO')),
  "content"     TEXT         NOT NULL,
  "readAt"      TIMESTAMPTZ,
  "createdAt"   TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "Message_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Message_personalId_fkey"
    FOREIGN KEY ("personalId") REFERENCES "PersonalProfile"("id") ON DELETE CASCADE,
  CONSTRAINT "Message_alunoId_fkey"
    FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "Message_personalId_idx" ON "Message"("personalId");
CREATE INDEX IF NOT EXISTS "Message_alunoId_idx"    ON "Message"("alunoId");
CREATE INDEX IF NOT EXISTS "Message_createdAt_idx"  ON "Message"("createdAt");
