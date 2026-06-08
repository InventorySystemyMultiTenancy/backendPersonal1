ALTER TABLE public."PhysicalAssessment"
  ADD COLUMN IF NOT EXISTS "leanMassPercentage" NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS "fatWeight" NUMERIC NULL;
