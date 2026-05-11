-- CreateTable CustomExercise
CREATE TABLE IF NOT EXISTS public."CustomExercise" (
  "id" UUID PRIMARY KEY,
  "personalId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "muscleGroup" TEXT NOT NULL,
  "equipment" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomExercise_personalId_fkey"
    FOREIGN KEY ("personalId") REFERENCES public."PersonalProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomExercise_personalId_name_key"
    UNIQUE ("personalId", "name")
);

CREATE INDEX IF NOT EXISTS "CustomExercise_personalId_idx" ON public."CustomExercise"("personalId");
CREATE INDEX IF NOT EXISTS "CustomExercise_muscleGroup_idx" ON public."CustomExercise"("muscleGroup");
