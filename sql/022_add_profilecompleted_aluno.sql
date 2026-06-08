DO $$
BEGIN
  ALTER TABLE public."Aluno"
    ADD COLUMN IF NOT EXISTS "profileCompleted" BOOLEAN NOT NULL DEFAULT FALSE;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

UPDATE public."Aluno"
SET "profileCompleted" = TRUE
WHERE "profileCompleted" = FALSE
  AND NULLIF(TRIM("fullName"), '') IS NOT NULL
  AND "birthDate" IS NOT NULL
  AND NULLIF(TRIM(COALESCE("gender", '')), '') IS NOT NULL;
