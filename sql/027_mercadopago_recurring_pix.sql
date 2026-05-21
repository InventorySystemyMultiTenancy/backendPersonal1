SET search_path TO public;

DO $$
BEGIN
  IF to_regclass('public."AlunoSubscription"') IS NULL THEN
    RAISE EXCEPTION 'Tabela public."AlunoSubscription" nao encontrada. Execute as migrations anteriores antes de sql/027_mercadopago_recurring_pix.sql';
  END IF;
END $$;

ALTER TABLE "AlunoSubscription"
  ALTER COLUMN mp_preapproval_id DROP NOT NULL;

ALTER TABLE "AlunoSubscription"
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'card',
  ADD COLUMN IF NOT EXISTS mp_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS pix_qr_code TEXT,
  ADD COLUMN IF NOT EXISTS pix_qr_code_base64 TEXT,
  ADD COLUMN IF NOT EXISTS pix_expires_at TIMESTAMPTZ;

UPDATE "AlunoSubscription"
SET payment_method = 'card'
WHERE payment_method IS NULL;

CREATE INDEX IF NOT EXISTS idx_aluno_subscription_mp_payment
  ON "AlunoSubscription" (mp_payment_id);
