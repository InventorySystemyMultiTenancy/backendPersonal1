SET search_path TO public;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Adicionar campos ao AlunoPlan para sincronização com Mercado Pago
ALTER TABLE "AlunoPlan" 
ADD COLUMN IF NOT EXISTS mp_plan_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS mp_sync_status TEXT DEFAULT 'pending' CHECK (mp_sync_status IN ('pending', 'synced', 'error')),
ADD COLUMN IF NOT EXISTS mp_sync_error TEXT,
ADD COLUMN IF NOT EXISTS mp_synced_at TIMESTAMPTZ;

-- Tabela de Assinaturas de Alunos (Mercado Pago Preapproval)
CREATE TABLE IF NOT EXISTS "AlunoSubscription" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "alunoId" UUID NOT NULL REFERENCES "Aluno"(id) ON DELETE CASCADE,
  "alunoPlanId" UUID NOT NULL REFERENCES "AlunoPlan"(id) ON DELETE RESTRICT,
  payer_email TEXT NOT NULL,
  mp_preapproval_id TEXT NOT NULL UNIQUE,
  mp_plan_id TEXT NOT NULL,
  external_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'paused', 'canceled')),
  provider_status TEXT,
  next_payment_date TIMESTAMPTZ,
  card_token_last4 TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aluno_subscription_aluno
  ON "AlunoSubscription" ("alunoId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_aluno_subscription_status
  ON "AlunoSubscription" (status, "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_aluno_subscription_external_reference
  ON "AlunoSubscription" (external_reference);

CREATE INDEX IF NOT EXISTS idx_aluno_subscription_mp_preapproval
  ON "AlunoSubscription" (mp_preapproval_id);

-- Tabela de Eventos de Assinatura (para auditoria e webhooks)
CREATE TABLE IF NOT EXISTS "AlunoSubscriptionEvent" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "alunoSubscriptionId" UUID REFERENCES "AlunoSubscription"(id) ON DELETE CASCADE,
  provider_event_key TEXT,
  type TEXT NOT NULL,
  status TEXT,
  message TEXT,
  payload JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_aluno_subscription_event_key
  ON "AlunoSubscriptionEvent" (provider_event_key)
  WHERE provider_event_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_aluno_subscription_event_subscription
  ON "AlunoSubscriptionEvent" ("alunoSubscriptionId", "createdAt" DESC);
