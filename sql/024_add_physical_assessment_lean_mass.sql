ALTER TABLE public."PhysicalAssessment"
  ADD COLUMN IF NOT EXISTS "leanMass" NUMERIC NULL;
