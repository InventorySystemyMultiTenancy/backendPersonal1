-- Add profile fields to Aluno and create PhysicalAssessment table

DO $$
BEGIN
  ALTER TABLE public."Aluno"
    ADD COLUMN IF NOT EXISTS "gender" TEXT NULL;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public."Aluno"
    ADD COLUMN IF NOT EXISTS "photoUrl" TEXT NULL;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public."PhysicalAssessment" (
  "id" UUID PRIMARY KEY,
  "personalId" UUID NOT NULL,
  "alunoId" UUID NOT NULL,
  "date" TIMESTAMP(3) NULL,
  "weight" NUMERIC NULL,
  "height" NUMERIC NULL,
  "fatPercentage" NUMERIC NULL,
  "age" INTEGER NULL,
  "notes" TEXT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PhysicalAssessment_personalId_fkey"
    FOREIGN KEY ("personalId") REFERENCES public."PersonalProfile"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PhysicalAssessment_alunoId_fkey"
    FOREIGN KEY ("alunoId") REFERENCES public."Aluno"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PhysicalAssessment_personalId_idx" ON public."PhysicalAssessment"("personalId");
CREATE INDEX IF NOT EXISTS "PhysicalAssessment_alunoId_idx" ON public."PhysicalAssessment"("alunoId");
CREATE INDEX IF NOT EXISTS "PhysicalAssessment_date_idx" ON public."PhysicalAssessment"("date");

DO $$
BEGIN
  ALTER TABLE public."PhysicalAssessment"
    ADD COLUMN IF NOT EXISTS "photos" JSON NULL;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;
