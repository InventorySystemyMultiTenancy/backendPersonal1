SET search_path TO public;

DO $$
BEGIN
  IF to_regclass('public."AlunoPlan"') IS NULL THEN
    RAISE EXCEPTION 'Tabela public."AlunoPlan" nao encontrada. Execute as migrations anteriores antes de sql/028_aluno_plan_billing_interval.sql';
  END IF;
END $$;

ALTER TABLE "AlunoPlan"
  ADD COLUMN IF NOT EXISTS "billingIntervalMonths" INTEGER NOT NULL DEFAULT 1;

UPDATE "AlunoPlan"
SET "billingIntervalMonths" = 1
WHERE "billingIntervalMonths" IS NULL
   OR "billingIntervalMonths" NOT IN (1, 3, 6, 12);

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'AlunoPlan'
      AND c.conname = 'AlunoPlan_billingIntervalMonths_check'
  LOOP
    EXECUTE format('ALTER TABLE "AlunoPlan" DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE "AlunoPlan"
  ADD CONSTRAINT "AlunoPlan_billingIntervalMonths_check"
  CHECK ("billingIntervalMonths" IN (1, 3, 6, 12));
