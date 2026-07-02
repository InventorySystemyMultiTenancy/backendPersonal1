const { randomUUID } = require("node:crypto");
const { prisma } = require("../db/prisma");

const MP_API_BASE_URL = String(
  process.env.MP_API_BASE_URL || "https://api.mercadopago.com",
).trim();
const MP_REQUEST_TIMEOUT_MS = Number(
  process.env.MP_REQUEST_TIMEOUT_MS || 10000,
);
const MP_MAX_RETRIES = Number(process.env.MP_MAX_RETRIES || 2);
const PAYMENT_DEBUG_LOGS =
  String(process.env.PAYMENT_DEBUG_LOGS || "").trim() === "true";
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PIX_REFERENCE_PREFIX = "subscription_pix:";
const ALLOWED_BILLING_INTERVAL_MONTHS = new Set([1, 3, 6, 12]);
let recurringSchemaChecked = false;
let recurringSchemaCheckPromise = null;

function logPayment(event, payload) {
  if (!PAYMENT_DEBUG_LOGS) return;
  console.log(`[payments:${event}]`, JSON.stringify(payload));
}

function sanitizeAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Valor de pagamento inválido");
  }
  return Number(amount.toFixed(2));
}

function normalizeNullable(value) {
  const text = String(value || "").trim();
  return text ? text : null;
}

function normalizeSubscriptionStatus(rawStatus, fallback = "pending") {
  const status = String(rawStatus || "")
    .trim()
    .toLowerCase();
  if (!status) return fallback;
  if (status === "authorized" || status === "active" || status === "approved") {
    return "authorized";
  }
  if (status === "paused" || status === "suspended") return "paused";
  if (status === "cancelled" || status === "canceled") return "canceled";
  if (status === "pending") return "pending";
  return fallback;
}

function mapSubscriptionStatusForFrontend(rawStatus) {
  return normalizeSubscriptionStatus(rawStatus, "unknown");
}

function mapPaymentStatusToSubscriptionStatus(rawStatus) {
  const status = String(rawStatus || "")
    .trim()
    .toLowerCase();
  if (!status) return "pending";
  if (status === "approved") return "authorized";
  if (status === "pending" || status === "in_process") return "pending";
  if (status === "cancelled" || status === "canceled") return "canceled";
  if (status === "rejected" || status === "refunded" || status === "charged_back") {
    return "paused";
  }
  return "pending";
}

function isValidEmail(email) {
  const text = String(email || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}

function normalizeFrequency(value = 1) {
  const number = Number(value ?? 1);
  return !Number.isInteger(number) || number <= 0 ? 1 : number;
}

function normalizeBillingIntervalMonths(value) {
  const interval = Number(value ?? 1);
  if (!Number.isInteger(interval) || !ALLOWED_BILLING_INTERVAL_MONTHS.has(interval)) {
    return 1;
  }
  return interval;
}

function getPlanBillingIntervalMonths(plan) {
  return normalizeBillingIntervalMonths(plan?.billingIntervalMonths);
}

function addPlanBillingInterval(date, plan) {
  const nextDate = new Date(date || Date.now());
  nextDate.setMonth(nextDate.getMonth() + getPlanBillingIntervalMonths(plan));
  return nextDate;
}

function isPastDueDate(value) {
  if (!value) return false;
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  return due < today;
}

function getNextDueDateAfterPayment(currentDueDate, plan) {
  let nextDueDate = addPlanBillingInterval(currentDueDate || new Date(), plan);
  let guard = 0;

  while (isPastDueDate(nextDueDate) && guard < 24) {
    nextDueDate = addPlanBillingInterval(nextDueDate, plan);
    guard += 1;
  }

  return nextDueDate;
}

function toPlanResponse(plan) {
  const billingIntervalMonths = getPlanBillingIntervalMonths(plan);
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description || null,
    imageUrl: plan.imageUrl || null,
    image_url: plan.imageUrl || null,
    transaction_amount: plan.monthlyPriceCents / 100,
    frequency: billingIntervalMonths,
    frequency_type: "months",
    billingIntervalMonths,
    currency_id: "BRL",
    preapproval_plan_id: plan.mp_plan_id,
  };
}

function ensureMercadoPagoToken() {
  const token = normalizeNullable(process.env.MERCADO_PAGO_ACCESS_TOKEN);
  if (!token) {
    throw new Error("Access Token do Mercado Pago não configurado");
  }
  return token;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeParseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_error) {
    return { message: text };
  }
}

async function mercadoPagoRequest({
  path,
  method = "GET",
  token,
  payload,
  idempotencyKey,
  timeoutMs = MP_REQUEST_TIMEOUT_MS,
  retries = MP_MAX_RETRIES,
}) {
  const url = `${MP_API_BASE_URL}${path}`;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      if (payload !== undefined) {
        headers["Content-Type"] = "application/json";
      }

      if (idempotencyKey) {
        headers["X-Idempotency-Key"] = idempotencyKey;
      }

      const response = await fetch(url, {
        method,
        headers,
        body: payload !== undefined ? JSON.stringify(payload) : undefined,
        signal: controller.signal,
      });

      const text = await response.text();
      const data = safeParseJson(text);

      if (response.ok) {
        return data;
      }

      if (
        (response.status >= 500 || response.status === 429) &&
        attempt < retries
      ) {
        await sleep(200 * (attempt + 1));
        continue;
      }

      throw new Error(
        `Erro Mercado Pago (${response.status}): ${data?.message || "Erro desconhecido"}`,
      );
    } catch (error) {
      const shouldRetry =
        (error.name === "AbortError" || error.code === "ECONNRESET") &&
        attempt < retries;
      if (shouldRetry) {
        await sleep(200 * (attempt + 1));
        continue;
      }
      if (error.name === "AbortError") {
        throw new Error("Timeout ao comunicar com Mercado Pago");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error("Falha de comunicação com Mercado Pago");
}

function toSubscriptionExternalReference(alunoId) {
  return `subscription:${alunoId}`;
}

function getBillingCycleKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function toPixExternalReference(subscriptionId, cycleKey) {
  const key = normalizeNullable(cycleKey) || getBillingCycleKey();
  return `${PIX_REFERENCE_PREFIX}${subscriptionId}:${key}`;
}

function fromPixExternalReference(reference) {
  const text = String(reference || "").trim();
  if (!text.startsWith(PIX_REFERENCE_PREFIX)) {
    return null;
  }
  const parts = text.slice(PIX_REFERENCE_PREFIX.length).split(":");
  if (!parts[0] || !UUID_REGEX.test(parts[0])) {
    return null;
  }
  return { subscriptionId: parts[0], cycleKey: parts[1] || null };
}

function ensureSubscriptionEmail(email) {
  const normalized = normalizeNullable(email);
  if (!normalized) throw new Error("Email do assinante obrigatório");
  if (!isValidEmail(normalized)) throw new Error("Email do assinante inválido");
  return normalized;
}

async function ensureRecurringSchemaCompatibility(force = false) {
  if (recurringSchemaChecked && !force) {
    return;
  }

  if (recurringSchemaCheckPromise) {
    return recurringSchemaCheckPromise;
  }

  recurringSchemaCheckPromise = (async () => {
    try {
      // Safety net for production environments where recurring SQL ran partially.
      await prisma.$executeRawUnsafe(`
        ALTER TABLE IF EXISTS "AlunoPlan"
        ADD COLUMN IF NOT EXISTS mp_plan_id TEXT,
        ADD COLUMN IF NOT EXISTS mp_sync_status TEXT DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS mp_sync_error TEXT,
        ADD COLUMN IF NOT EXISTS mp_synced_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "imageUrl" TEXT,
        ADD COLUMN IF NOT EXISTS "billingIntervalMonths" INTEGER NOT NULL DEFAULT 1;
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE IF EXISTS "AlunoSubscription"
        ADD COLUMN IF NOT EXISTS mp_plan_id TEXT,
        ADD COLUMN IF NOT EXISTS external_reference TEXT,
        ADD COLUMN IF NOT EXISTS provider_status TEXT,
        ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'card',
        ADD COLUMN IF NOT EXISTS mp_payment_id TEXT,
        ADD COLUMN IF NOT EXISTS pix_qr_code TEXT,
        ADD COLUMN IF NOT EXISTS pix_qr_code_base64 TEXT,
        ADD COLUMN IF NOT EXISTS pix_expires_at TIMESTAMPTZ;
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE IF EXISTS "AlunoSubscription"
        ALTER COLUMN mp_preapproval_id DROP NOT NULL;
      `);

      recurringSchemaChecked = true;
      logPayment("schema-compat:ok", { source: "runtime" });
    } catch (error) {
      logPayment("schema-compat:error", {
        code: error?.code || null,
        message: error?.message || null,
      });
      throw new Error(
        "Schema de recorrencia desatualizado. Execute sql/014_mercadopago_recurring_subscriptions.sql no banco de producao.",
      );
    } finally {
      recurringSchemaCheckPromise = null;
    }
  })();

  return recurringSchemaCheckPromise;
}

function isRecurringSchemaError(error) {
  if (!error || error.code !== "P2022") {
    return false;
  }

  const details =
    `${error?.meta?.column || ""} ${error?.message || ""}`.toLowerCase();
  return (
    details.includes("alunosubscription") ||
    details.includes("alunoplan") ||
    details.includes("mp_plan_id") ||
    details.includes("billingintervalmonths") ||
    details.includes("external_reference") ||
    details.includes("provider_status") ||
    details.includes("payment_method") ||
    details.includes("mp_payment_id") ||
    details.includes("pix_qr_code") ||
    details.includes("pix_qr_code_base64") ||
    details.includes("pix_expires_at") ||
    details.includes("mp_preapproval_id")
  );
}

async function withRecurringSchemaRetry(operation, operationName) {
  try {
    return await operation();
  } catch (error) {
    if (!isRecurringSchemaError(error)) {
      throw error;
    }

    logPayment("schema-compat:retry", {
      operationName,
      column: error?.meta?.column || null,
      message: error?.message || null,
    });

    await ensureRecurringSchemaCompatibility(true);
    return operation();
  }
}

async function resolveAlunoId({ alunoId, authUserId, personalId }) {
  const normalizedAlunoId = normalizeNullable(alunoId);
  if (normalizedAlunoId) {
    return normalizedAlunoId;
  }

  const normalizedAuthUserId = normalizeNullable(authUserId);
  if (!normalizedAuthUserId) {
    return null;
  }

  const alunoFromUser = await prisma.aluno.findFirst({
    where: {
      userId: normalizedAuthUserId,
      personalId,
    },
    select: { id: true },
  });

  return alunoFromUser?.id || null;
}

// List Public Plans - Retorna planos Ativos que já têm mp_plan_id sincronizado
async function listPublicSubscriptionPlans(personalId) {
  await ensureRecurringSchemaCompatibility();

  logPayment("list-public-plans:start", { personalId });

  if (!UUID_REGEX.test(String(personalId || "").trim())) {
    logPayment("list-public-plans:invalid-personal-id", { personalId });
    throw new Error("personalId inválido para listagem de planos");
  }

  const activeCount = await prisma.alunoPlan.count({
    where: {
      personalId,
      isActive: true,
    },
  });

  const syncedCount = await prisma.alunoPlan.count({
    where: {
      personalId,
      isActive: true,
      mp_plan_id: { not: null },
    },
  });

  const plans = await prisma.alunoPlan.findMany({
    where: {
      personalId,
      isActive: true,
      mp_plan_id: { not: null }, // Apenas planos sincronizados
    },
    orderBy: { monthlyPriceCents: "asc" },
  });

  logPayment("list-public-plans:counts", {
    personalId,
    activeCount,
    syncedCount,
    returnedCount: plans.length,
  });

  return plans.map(toPlanResponse);
}

// Sincronizar um plano do banco com Mercado Pago
async function syncAlunoPlanWithMercadoPago({
  alunoPlanId,
  personalId,
  force = false,
}) {
  await ensureRecurringSchemaCompatibility();

  const plan = await prisma.alunoPlan.findUnique({
    where: { id: alunoPlanId },
  });

  if (!plan || plan.personalId !== personalId) {
    throw new Error("Plano não encontrado");
  }

  if (plan.mp_plan_id && !force) {
    // Já sincronizado
    return { plan, alreadySynced: true };
  }

  const token = ensureMercadoPagoToken();
  const transactionAmount = sanitizeAmount(plan.monthlyPriceCents / 100);
  const billingIntervalMonths = getPlanBillingIntervalMonths(plan);

  try {
    const created = await mercadoPagoRequest({
      path: "/preapproval_plan",
      method: "POST",
      token,
      idempotencyKey: `plan:${plan.id}:${plan.name}:${plan.monthlyPriceCents}:${billingIntervalMonths}`,
      payload: {
        reason: plan.name,
        auto_recurring: {
          frequency: billingIntervalMonths,
          frequency_type: "months",
          transaction_amount: transactionAmount,
          currency_id: "BRL",
        },
        back_url: process.env.FRONTEND_URL || "https://seusite.com.br",
      },
    });

    const mpPlanId = String(created?.id || "").trim();

    // Atualizar plano com ID do MP
    const updated = await prisma.alunoPlan.update({
      where: { id: alunoPlanId },
      data: {
        mp_plan_id: mpPlanId,
        mp_sync_status: "synced",
        mp_sync_error: null,
        mp_synced_at: new Date(),
      },
    });

    logPayment("sync-plan-success", {
      alunoPlanId,
      plan_name: plan.name,
      billingIntervalMonths,
      mp_plan_id: mpPlanId,
    });

    return { plan: updated, alreadySynced: false };
  } catch (error) {
    // Registrar erro de sincronização
    await prisma.alunoPlan.update({
      where: { id: alunoPlanId },
      data: {
        mp_sync_status: "error",
        mp_sync_error: error.message,
      },
    });

    logPayment("sync-plan-error", {
      alunoPlanId,
      error: error.message,
    });

    throw error;
  }
}

// Criar assinatura para aluno com plano existente
async function createSubscription({
  alunoId,
  alunoPlanId,
  preapprovalPlanId,
  payerEmail,
  cardTokenId,
  authUserId,
  personalId, // REQUIRED: validação de multi-tenant
}) {
  await ensureRecurringSchemaCompatibility();

  const resolvedAlunoId = await resolveAlunoId({
    alunoId,
    authUserId,
    personalId,
  });

  if (!resolvedAlunoId) {
    throw new Error("aluno_id obrigatório");
  }

  logPayment("create-subscription:resolve-aluno-by-user", {
    authUserId,
    resolvedAlunoId,
  });

  logPayment("create-subscription:start", {
    alunoId: resolvedAlunoId,
    alunoPlanId,
    preapprovalPlanId,
    personalId,
    hasCardToken: Boolean(cardTokenId),
  });

  const token = ensureMercadoPagoToken();
  const finalEmail = ensureSubscriptionEmail(payerEmail);
  const finalToken = normalizeNullable(cardTokenId);

  if (!finalToken) {
    throw new Error("card_token_id obrigatório");
  }

  if (!personalId) {
    throw new Error("personalId obrigatório para validação");
  }

  // Verificar aluno
  const aluno = await prisma.aluno.findUnique({
    where: { id: resolvedAlunoId },
    include: { alunoPlan: true },
  });

  if (!aluno) {
    logPayment("create-subscription:aluno-not-found", {
      alunoId: resolvedAlunoId,
      personalId,
    });
    throw new Error("Aluno não encontrado");
  }

  // VALIDAÇÃO MULTI-TENANT: Aluno deve pertencer ao mesmo personal
  if (aluno.personalId !== personalId) {
    logPayment("create-subscription:aluno-tenant-mismatch", {
      alunoId: resolvedAlunoId,
      alunoPersonalId: aluno.personalId,
      requestedPersonalId: personalId,
    });
    throw new Error("Aluno não pertence a este personal");
  }

  // Verificar plano (compatível com alunoPlanId ou preapproval_plan_id do exemploback)
  let plan = null;

  if (alunoPlanId) {
    plan = await prisma.alunoPlan.findUnique({
      where: { id: alunoPlanId },
    });
  } else if (preapprovalPlanId) {
    const normalizedPreapprovalPlanId = String(preapprovalPlanId).trim();

    // Compatibilidade com frontend legado:
    // 1) primeiro tenta como mp_plan_id (Mercado Pago)
    // 2) se vier UUID interno, resolve por id do AlunoPlan
    plan = await prisma.alunoPlan.findFirst({
      where: {
        personalId,
        mp_plan_id: normalizedPreapprovalPlanId,
      },
    });

    if (!plan && UUID_REGEX.test(normalizedPreapprovalPlanId)) {
      plan = await prisma.alunoPlan.findFirst({
        where: {
          id: normalizedPreapprovalPlanId,
          personalId,
        },
      });

      logPayment(
        "create-subscription:resolved-preapproval-as-internal-plan-id",
        {
          preapprovalPlanId: normalizedPreapprovalPlanId,
          resolvedPlanId: plan?.id || null,
        },
      );
    }
  }

  if (!plan) {
    logPayment("create-subscription:plan-not-found", {
      alunoPlanId,
      preapprovalPlanId,
      personalId,
    });
    throw new Error("Plano de assinatura não encontrado");
  }

  // Se o plano estiver ativo mas sem mp_plan_id, tenta sincronizar automaticamente.
  if (plan.isActive && !plan.mp_plan_id) {
    logPayment("create-subscription:auto-sync-plan:start", {
      alunoPlanId: plan.id,
      personalId,
    });
    const syncResult = await syncAlunoPlanWithMercadoPago({
      alunoPlanId: plan.id,
      personalId,
    });
    plan = syncResult.plan;
    logPayment("create-subscription:auto-sync-plan:done", {
      alunoPlanId: plan.id,
      mp_plan_id: plan.mp_plan_id,
      alreadySynced: syncResult.alreadySynced,
    });
  }

  if (!plan || !plan.isActive || !plan.mp_plan_id) {
    logPayment("create-subscription:plan-invalid", {
      alunoPlanId: plan?.id || alunoPlanId,
      preapprovalPlanId,
      exists: Boolean(plan),
      isActive: Boolean(plan?.isActive),
      hasMpPlanId: Boolean(plan?.mp_plan_id),
      mpSyncStatus: plan?.mp_sync_status || null,
      mpSyncError: plan?.mp_sync_error || null,
    });
    throw new Error("Plano de assinatura inativo ou não sincronizado");
  }

  // VALIDAÇÃO MULTI-TENANT: Plano deve pertencer ao mesmo personal
  if (plan.personalId !== personalId) {
    logPayment("create-subscription:plan-tenant-mismatch", {
      alunoPlanId: plan.id,
      planPersonalId: plan.personalId,
      requestedPersonalId: personalId,
    });
    throw new Error("Plano não pertence a este personal");
  }

  // Verificar se já tem assinatura ativa
  const existingSubscription = await withRecurringSchemaRetry(
    () =>
      prisma.alunoSubscription.findFirst({
        where: {
          alunoId: resolvedAlunoId,
          status: { in: ["pending", "authorized"] },
        },
      }),
    "create-subscription:find-existing",
  );

  if (existingSubscription) {
    throw new Error("Aluno já possui uma assinatura ativa");
  }

  const finalPlanId = plan.mp_plan_id;
  const externalReference = toSubscriptionExternalReference(resolvedAlunoId);

  try {
    const created = await mercadoPagoRequest({
      path: "/preapproval",
      method: "POST",
      token,
      idempotencyKey: `subscription:${resolvedAlunoId}:${finalPlanId}`,
      payload: {
        preapproval_plan_id: finalPlanId,
        payer_email: finalEmail,
        card_token_id: finalToken,
        reason: plan.name,
        status: "authorized",
        external_reference: externalReference,
        back_url: process.env.FRONTEND_URL || "https://seusite.com.br",
      },
    });

    const mpPreapprovalId = String(created?.id || "").trim();

    // Criar registro de assinatura
    const subscription = await withRecurringSchemaRetry(
      () =>
        prisma.alunoSubscription.create({
          data: {
            alunoId: resolvedAlunoId,
            alunoPlanId: plan.id,
            payer_email: created?.payer_email || finalEmail,
            mp_preapproval_id: mpPreapprovalId,
            mp_plan_id: created?.preapproval_plan_id || finalPlanId,
            external_reference:
              created?.external_reference || externalReference,
            status: normalizeSubscriptionStatus(
              created?.status || "authorized",
            ),
            provider_status: created?.status,
            next_payment_date: created?.next_payment_date
              ? new Date(created.next_payment_date)
              : null,
            card_token_last4: created?.card_id
              ? String(created.card_id).slice(-4)
              : null,
            payment_method: "card",
          },
          include: { alunoPlan: true },
        }),
      "create-subscription:create-row",
    );

    // Calcular planDueDate seguindo a recorrencia configurada no plano.
    const subscriptionStartDate = new Date();
    const planDueDate = getNextDueDateAfterPayment(subscriptionStartDate, plan);

    // Atualizar aluno com novo plano e data de vencimento
    await prisma.aluno.update({
      where: { id: resolvedAlunoId },
      data: {
        alunoPlanId: plan.id,
        planDueDate,
      },
    });

    logPayment("create-subscription", {
      alunoId: resolvedAlunoId,
      alunoPlanId: plan.id,
      mp_preapproval_id: mpPreapprovalId,
      status: created?.status,
    });

    return {
      subscription: {
        id: subscription.id,
        mp_preapproval_id: subscription.mp_preapproval_id,
        status: subscription.status,
        email: subscription.payer_email,
        next_payment_date: subscription.next_payment_date,
        plan_name: plan.name,
      },
      provider: {
        id: created?.id || null,
        status: created?.status || null,
        next_payment_date: created?.next_payment_date || null,
      },
    };
  } catch (error) {
    logPayment("create-subscription-error", {
      alunoId: resolvedAlunoId,
      error: error.message,
    });
    throw error;
  }
}

async function createPixChargeForSubscription({
  subscription,
  plan,
  payerEmail,
  payerName,
  idempotencyKey,
}) {
  const token = ensureMercadoPagoToken();
  const finalEmail = ensureSubscriptionEmail(payerEmail);
  const finalName = normalizeNullable(payerName) || "Cliente";
  const transactionAmount = sanitizeAmount(plan.monthlyPriceCents / 100);
  const cycleKey = getBillingCycleKey();
  const externalReference = toPixExternalReference(subscription.id, cycleKey);

  const notificationUrlBase = normalizeNullable(process.env.BACKEND_PUBLIC_URL);
  const notificationUrl = notificationUrlBase
    ? `${notificationUrlBase.replace(/\/$/, "")}/api/payments/recurring/webhooks/mercadopago`
    : undefined;

  const created = await mercadoPagoRequest({
    path: "/v1/payments",
    method: "POST",
    token,
    idempotencyKey: idempotencyKey || `pix:${subscription.id}:${cycleKey}`,
    payload: {
      transaction_amount: transactionAmount,
      description: plan.name,
      payment_method_id: "pix",
      external_reference: externalReference,
      payer: {
        email: finalEmail,
        first_name: finalName,
      },
      notification_url: notificationUrl,
    },
  });

  const updated = await prisma.alunoSubscription.update({
    where: { id: subscription.id },
    data: {
      provider_status: created?.status || subscription.provider_status,
      status: mapPaymentStatusToSubscriptionStatus(created?.status),
      mp_payment_id: created?.id ? String(created.id) : subscription.mp_payment_id,
      pix_qr_code:
        created?.point_of_interaction?.transaction_data?.qr_code ||
        subscription.pix_qr_code,
      pix_qr_code_base64:
        created?.point_of_interaction?.transaction_data?.qr_code_base64 ||
        subscription.pix_qr_code_base64,
      pix_expires_at: created?.date_of_expiration
        ? new Date(created.date_of_expiration)
        : subscription.pix_expires_at,
    },
    include: { alunoPlan: true },
  });

  return {
    subscription: updated,
    provider: {
      id: created?.id || null,
      status: created?.status || null,
      qr_code:
        created?.point_of_interaction?.transaction_data?.qr_code || null,
      qr_code_base64:
        created?.point_of_interaction?.transaction_data?.qr_code_base64 || null,
      expires_at: created?.date_of_expiration || null,
    },
  };
}

// Criar assinatura PIX para aluno (gera primeira cobranca PIX)
async function createPixSubscription({
  alunoId,
  alunoPlanId,
  preapprovalPlanId,
  payerEmail,
  payerName,
  authUserId,
  personalId,
}) {
  await ensureRecurringSchemaCompatibility();

  const resolvedAlunoId = await resolveAlunoId({
    alunoId,
    authUserId,
    personalId,
  });

  if (!resolvedAlunoId) {
    throw new Error("aluno_id obrigatório");
  }

  if (!personalId) {
    throw new Error("personalId obrigatório para validação");
  }

  const finalEmail = ensureSubscriptionEmail(payerEmail);

  const aluno = await prisma.aluno.findUnique({
    where: { id: resolvedAlunoId },
    include: { alunoPlan: true },
  });

  if (!aluno) {
    throw new Error("Aluno não encontrado");
  }

  if (aluno.personalId !== personalId) {
    throw new Error("Aluno não pertence a este personal");
  }

  let plan = null;

  if (alunoPlanId) {
    plan = await prisma.alunoPlan.findUnique({
      where: { id: alunoPlanId },
    });
  } else if (preapprovalPlanId) {
    const normalizedPreapprovalPlanId = String(preapprovalPlanId).trim();
    plan = await prisma.alunoPlan.findFirst({
      where: {
        personalId,
        mp_plan_id: normalizedPreapprovalPlanId,
      },
    });

    if (!plan && UUID_REGEX.test(normalizedPreapprovalPlanId)) {
      plan = await prisma.alunoPlan.findFirst({
        where: {
          id: normalizedPreapprovalPlanId,
          personalId,
        },
      });
    }
  }

  if (!plan) {
    throw new Error("Plano de assinatura não encontrado");
  }

  if (plan.isActive && !plan.mp_plan_id) {
    const syncResult = await syncAlunoPlanWithMercadoPago({
      alunoPlanId: plan.id,
      personalId,
    });
    plan = syncResult.plan;
  }

  if (!plan || !plan.isActive || !plan.mp_plan_id) {
    throw new Error("Plano de assinatura inativo ou não sincronizado");
  }

  if (plan.personalId !== personalId) {
    throw new Error("Plano não pertence a este personal");
  }

  const existingSubscription = await withRecurringSchemaRetry(
    () =>
      prisma.alunoSubscription.findFirst({
        where: {
          alunoId: resolvedAlunoId,
          status: { in: ["pending", "authorized"] },
        },
        include: { alunoPlan: true, aluno: true },
        orderBy: { createdAt: "desc" },
      }),
    "create-pix-subscription:find-existing",
  );

  if (existingSubscription) {
    const existingStatus = normalizeSubscriptionStatus(
      existingSubscription.status,
    );
    const existingIsPix = existingSubscription.payment_method === "pix";
    const existingIsOverdue = isPastDueDate(aluno.planDueDate);

    if (existingIsPix && (existingStatus === "pending" || existingIsOverdue)) {
      return createPixCharge({
        subscriptionId: existingSubscription.id,
        alunoId: resolvedAlunoId,
        authUserId,
        personalId,
        payerEmail: finalEmail,
        payerName,
      });
    }
    throw new Error("Aluno já possui uma assinatura ativa");
  }

  const subscription = await withRecurringSchemaRetry(
    () =>
      prisma.alunoSubscription.create({
        data: {
          alunoId: resolvedAlunoId,
          alunoPlanId: plan.id,
          payer_email: finalEmail,
          mp_preapproval_id: null,
          mp_plan_id: plan.mp_plan_id,
          external_reference: toSubscriptionExternalReference(resolvedAlunoId),
          status: "pending",
          provider_status: "pending",
          payment_method: "pix",
        },
        include: { alunoPlan: true },
      }),
    "create-pix-subscription:create-row",
  );

  const chargeResult = await createPixChargeForSubscription({
    subscription,
    plan,
    payerEmail: finalEmail,
    payerName,
  });

  return {
    subscription: {
      id: chargeResult.subscription.id,
      status: chargeResult.subscription.status,
      email: chargeResult.subscription.payer_email,
      plan_name: plan.name,
      payment_method: "pix",
    },
    provider: chargeResult.provider,
  };
}

// Gerar nova cobranca PIX para assinatura existente
async function createPixCharge({
  subscriptionId,
  alunoId,
  authUserId,
  personalId,
  payerEmail,
  payerName,
  idempotencyKey,
}) {
  await ensureRecurringSchemaCompatibility();

  const resolvedAlunoId = await resolveAlunoId({
    alunoId,
    authUserId,
    personalId,
  });

  if (!resolvedAlunoId) {
    throw new Error("Aluno não encontrado para o usuário autenticado");
  }

  const subscription = await prisma.alunoSubscription.findUnique({
    where: { id: subscriptionId },
    include: { alunoPlan: true, aluno: true },
  });

  if (!subscription || subscription.alunoId !== resolvedAlunoId) {
    throw new Error("Assinatura não encontrada");
  }

  if (!personalId || subscription.aluno.personalId !== personalId) {
    throw new Error("Aluno não pertence a este personal");
  }

  if (subscription.payment_method !== "pix") {
    throw new Error("Assinatura não é PIX");
  }

  if (normalizeSubscriptionStatus(subscription.status) === "canceled") {
    throw new Error("Assinatura cancelada");
  }

  const hasValidPendingPix =
    (subscription.provider_status === "pending" ||
      subscription.provider_status === "in_process") &&
    subscription.pix_expires_at &&
    new Date(subscription.pix_expires_at) > new Date();

  if (hasValidPendingPix) {
    return {
      subscription: {
        id: subscription.id,
        status: subscription.status,
        email: subscription.payer_email,
        plan_name: subscription.alunoPlan?.name || null,
        payment_method: "pix",
      },
      provider: {
        id: subscription.mp_payment_id || null,
        status: subscription.provider_status || null,
        qr_code: subscription.pix_qr_code || null,
        qr_code_base64: subscription.pix_qr_code_base64 || null,
        expires_at: subscription.pix_expires_at || null,
      },
      reused: true,
    };
  }

  const chargeResult = await createPixChargeForSubscription({
    subscription,
    plan: subscription.alunoPlan,
    payerEmail: payerEmail || subscription.payer_email,
    payerName,
    idempotencyKey,
  });

  return {
    subscription: {
      id: chargeResult.subscription.id,
      status: chargeResult.subscription.status,
      email: chargeResult.subscription.payer_email,
      plan_name: subscription.alunoPlan?.name || null,
      payment_method: "pix",
    },
    provider: chargeResult.provider,
    reused: false,
  };
}

// Consultar status da assinatura
async function getSubscriptionStatus({
  alunoId,
  authUserId,
  subscriptionId,
  personalId,
}) {
  await ensureRecurringSchemaCompatibility();

  const token = ensureMercadoPagoToken();
  const resolvedAlunoId = await resolveAlunoId({
    alunoId,
    authUserId,
    personalId,
  });

  if (!resolvedAlunoId) {
    throw new Error("Aluno não encontrado para o usuário autenticado");
  }

  const subscription = await prisma.alunoSubscription.findUnique({
    where: { id: subscriptionId },
    include: { alunoPlan: true, aluno: true },
  });

  if (!subscription || subscription.alunoId !== resolvedAlunoId) {
    throw new Error("Assinatura não encontrada");
  }

  // VALIDAÇÃO MULTI-TENANT: Aluno deve pertencer ao mesmo personal
  if (!personalId || subscription.aluno.personalId !== personalId) {
    throw new Error("Aluno não pertence a este personal");
  }

  try {
    if (subscription.payment_method === "pix") {
      let provider = null;

      if (subscription.mp_payment_id) {
        provider = await mercadoPagoRequest({
          path: `/v1/payments/${subscription.mp_payment_id}`,
          method: "GET",
          token,
        }).catch(() => null);
      }

      let subscriptionStatus = subscription.status;

      if (provider) {
        const mappedStatus = mapPaymentStatusToSubscriptionStatus(
          provider.status,
        );
        subscriptionStatus = mappedStatus;

        const updateData = {
          status: mappedStatus,
          provider_status: provider.status,
        };

        if (provider.date_of_expiration) {
          updateData.pix_expires_at = new Date(provider.date_of_expiration);
        }

        await prisma.alunoSubscription.update({
          where: { id: subscriptionId },
          data: updateData,
        });

        if (mappedStatus === "authorized") {
          const currentDue = subscription.aluno.planDueDate
            ? new Date(subscription.aluno.planDueDate)
            : new Date();
          const newDueDate = getNextDueDateAfterPayment(
            currentDue,
            subscription.alunoPlan,
          );

          await prisma.aluno.update({
            where: { id: subscription.alunoId },
            data: { planDueDate: newDueDate },
          });

          await prisma.alunoSubscription.update({
            where: { id: subscriptionId },
            data: { next_payment_date: newDueDate },
          });
        }
      }

      return {
        subscription: {
          id: subscription.id,
          mp_preapproval_id: subscription.mp_preapproval_id,
          status: subscriptionStatus,
          email: subscription.payer_email,
          next_payment_date: subscription.next_payment_date,
          plan_name: subscription.alunoPlan?.name,
          payment_method: "pix",
        },
        provider: provider
          ? {
              id: provider?.id || null,
              status: provider?.status || null,
              qr_code:
                provider?.point_of_interaction?.transaction_data?.qr_code ||
                subscription.pix_qr_code ||
                null,
              qr_code_base64:
                provider?.point_of_interaction?.transaction_data
                  ?.qr_code_base64 ||
                subscription.pix_qr_code_base64 ||
                null,
              expires_at: provider?.date_of_expiration || null,
            }
          : null,
      };
    }

    const provider = await mercadoPagoRequest({
      path: `/preapproval/${subscription.mp_preapproval_id}`,
      method: "GET",
      token,
    }).catch(() => null);

    if (provider) {
      // Atualizar status local
      await prisma.alunoSubscription.update({
        where: { id: subscriptionId },
        data: {
          status: normalizeSubscriptionStatus(provider.status),
          provider_status: provider.status,
          next_payment_date: provider.next_payment_date
            ? new Date(provider.next_payment_date)
            : null,
        },
      });
    }

    return {
      subscription: {
        id: subscription.id,
        mp_preapproval_id: subscription.mp_preapproval_id,
        status: normalizeSubscriptionStatus(
          provider?.status || subscription.status,
        ),
        email: subscription.payer_email,
        next_payment_date:
          provider?.next_payment_date || subscription.next_payment_date,
        plan_name: subscription.alunoPlan?.name,
      },
      provider: {
        id: provider?.id || null,
        status: provider?.status || null,
        next_payment_date: provider?.next_payment_date || null,
      },
    };
  } catch (error) {
    // Retornar status local mesmo em erro
    return {
      subscription: {
        id: subscription.id,
        mp_preapproval_id: subscription.mp_preapproval_id,
        status: subscription.status,
        email: subscription.payer_email,
        next_payment_date: subscription.next_payment_date,
        plan_name: subscription.alunoPlan?.name,
      },
      provider: null,
    };
  }
}

// Cancelar assinatura
async function cancelSubscription({
  alunoId,
  authUserId,
  subscriptionId,
  personalId,
}) {
  await ensureRecurringSchemaCompatibility();

  const token = ensureMercadoPagoToken();
  const resolvedAlunoId = await resolveAlunoId({
    alunoId,
    authUserId,
    personalId,
  });

  if (!resolvedAlunoId) {
    throw new Error("Aluno não encontrado para o usuário autenticado");
  }

  const subscription = await prisma.alunoSubscription.findUnique({
    where: { id: subscriptionId },
    include: { aluno: true },
  });

  if (!subscription || subscription.alunoId !== resolvedAlunoId) {
    throw new Error("Assinatura não encontrada");
  }

  // VALIDAÇÃO MULTI-TENANT: Aluno deve pertencer ao mesmo personal
  if (!personalId || subscription.aluno.personalId !== personalId) {
    throw new Error("Aluno não pertence a este personal");
  }

  if (normalizeSubscriptionStatus(subscription.status) === "canceled") {
    throw new Error("Assinatura já cancelada");
  }

  if (subscription.payment_method === "pix") {
    const updated = await prisma.alunoSubscription.update({
      where: { id: subscriptionId },
      data: {
        status: "canceled",
        provider_status: subscription.provider_status || "canceled",
      },
    });

    await prisma.alunoSubscriptionEvent.create({
      data: {
        alunoSubscriptionId: subscription.id,
        type: "subscription_canceled",
        status: "canceled",
        message: "Cancelamento solicitado pelo usuário",
        payload: {
          mp_payment_id: subscription.mp_payment_id,
          payment_method: "pix",
        },
      },
    });

    await prisma.aluno.update({
      where: { id: resolvedAlunoId },
      data: { alunoPlanId: null },
    });

    logPayment("cancel-subscription", {
      alunoId: resolvedAlunoId,
      subscriptionId,
      payment_method: "pix",
    });

    return { subscription: updated, canceled: true };
  }

  try {
    const canceled = await mercadoPagoRequest({
      path: `/preapproval/${subscription.mp_preapproval_id}`,
      method: "PUT",
      token,
      payload: { status: "cancelled" },
    });

    const updated = await prisma.alunoSubscription.update({
      where: { id: subscriptionId },
      data: {
        status: "canceled",
        provider_status: canceled?.status || "cancelled",
      },
    });

    await prisma.alunoSubscriptionEvent.create({
      data: {
        alunoSubscriptionId: subscription.id,
        type: "subscription_canceled",
        status: "canceled",
        message: "Cancelamento solicitado pelo usuário",
        payload: {
          provider_status: canceled?.status || "cancelled",
          mp_preapproval_id: subscription.mp_preapproval_id,
        },
      },
    });

    // Remover plano do aluno
    await prisma.aluno.update({
      where: { id: resolvedAlunoId },
      data: { alunoPlanId: null },
    });

    logPayment("cancel-subscription", {
      alunoId: resolvedAlunoId,
      subscriptionId,
      mp_preapproval_id: subscription.mp_preapproval_id,
    });

    return { subscription: updated, canceled: true };
  } catch (error) {
    logPayment("cancel-subscription-error", {
      subscriptionId,
      error: error.message,
    });
    throw error;
  }
}

function nextIdempotencyKey() {
  return randomUUID();
}

// Processar evento de webhook do Mercado Pago com validação de personalId
async function processWebhookEvent({ eventId, eventData }) {
  await ensureRecurringSchemaCompatibility();

  if (!eventId || !eventData) {
    throw new Error("Event ID e data obrigatórios");
  }

  try {
    const topic = String(eventData?.topic || "")
      .trim()
      .toLowerCase();

    if (topic === "payment") {
      const paymentId = String(eventData?.id || eventId || "").trim();
      if (!paymentId) {
        logPayment("webhook-invalid", {
          eventId,
          reason: "Missing payment id",
        });
        return null;
      }

      const token = ensureMercadoPagoToken();
      const payment = await mercadoPagoRequest({
        path: `/v1/payments/${paymentId}`,
        method: "GET",
        token,
      }).catch(() => null);

      if (!payment) {
        logPayment("webhook-payment-not-found", { eventId, paymentId });
        return null;
      }

      const pixReference = fromPixExternalReference(
        payment.external_reference,
      );

      if (!pixReference) {
        logPayment("webhook-payment-ignored", {
          eventId,
          paymentId,
          external_reference: payment.external_reference || null,
        });
        return null;
      }

      const subscription = await prisma.alunoSubscription.findUnique({
        where: { id: pixReference.subscriptionId },
        include: { aluno: true, alunoPlan: true },
      });

      if (!subscription) {
        logPayment("webhook-not-found", {
          eventId,
          subscriptionId: pixReference.subscriptionId,
        });
        return null;
      }

      const personalId = subscription.aluno.personalId;
      if (subscription.alunoPlan.personalId !== personalId) {
        logPayment("webhook-tenant-mismatch", {
          eventId,
          subscriptionId: subscription.id,
          alunoPersonalId: personalId,
          planPersonalId: subscription.alunoPlan.personalId,
        });
        throw new Error("Tenant mismatch in webhook processing");
      }

      const mappedStatus = mapPaymentStatusToSubscriptionStatus(
        payment.status,
      );

      const event = await prisma.alunoSubscriptionEvent.create({
        data: {
          alunoSubscriptionId: subscription.id,
          type: "payment",
          provider_event_key: eventId,
          status: mappedStatus,
          payload: payment,
        },
      });

      const updateData = {
        status: mappedStatus,
        provider_status: payment.status,
        mp_payment_id: String(payment.id),
        pix_qr_code:
          payment?.point_of_interaction?.transaction_data?.qr_code || null,
        pix_qr_code_base64:
          payment?.point_of_interaction?.transaction_data?.qr_code_base64 ||
          null,
        pix_expires_at: payment?.date_of_expiration
          ? new Date(payment.date_of_expiration)
          : null,
      };

      await prisma.alunoSubscription.update({
        where: { id: subscription.id },
        data: updateData,
      });

      if (mappedStatus === "authorized") {
        const currentDue = subscription.aluno.planDueDate
          ? new Date(subscription.aluno.planDueDate)
          : new Date();
        const newDueDate = getNextDueDateAfterPayment(
          currentDue,
          subscription.alunoPlan,
        );

        await prisma.aluno.update({
          where: { id: subscription.alunoId },
          data: { planDueDate: newDueDate },
        });

        await prisma.alunoSubscription.update({
          where: { id: subscription.id },
          data: { next_payment_date: newDueDate },
        });
      }

      logPayment("webhook-processed", {
        eventId,
        subscriptionId: subscription.id,
        alunoId: subscription.alunoId,
        personalId,
        newStatus: mappedStatus,
      });

      return { subscription, event };
    }

    const { preapproval_id, status, external_reference } = eventData;

    if (!preapproval_id) {
      logPayment("webhook-invalid", {
        eventId,
        reason: "Missing preapproval_id",
      });
      return null;
    }

    // Encontrar assinatura pelo mp_preapproval_id
    const subscription = await prisma.alunoSubscription.findUnique({
      where: { mp_preapproval_id: preapproval_id },
      include: { aluno: true, alunoPlan: true },
    });

    if (!subscription) {
      logPayment("webhook-not-found", { eventId, preapproval_id });
      return null;
    }

    // VALIDAÇÃO: Garantir que subscription, aluno e plano têem o mesmo personalId
    const personalId = subscription.aluno.personalId;
    if (subscription.alunoPlan.personalId !== personalId) {
      logPayment("webhook-tenant-mismatch", {
        eventId,
        subscriptionId: subscription.id,
        alunoPersonalId: personalId,
        planPersonalId: subscription.alunoPlan.personalId,
      });
      throw new Error("Tenant mismatch in webhook processing");
    }

    // Registrar evento
    const event = await prisma.alunoSubscriptionEvent.create({
      data: {
        alunoSubscriptionId: subscription.id,
        type: eventData.topic || "preapproval",
        provider_event_key: eventId,
        status: normalizeSubscriptionStatus(status),
        payload: eventData,
      },
    });

    // Atualizar status da assinatura se mudou
    const normalizedStatus = normalizeSubscriptionStatus(status);
    if (
      status &&
      normalizedStatus !== normalizeSubscriptionStatus(subscription.status)
    ) {
      const subscriptionUpdateData = {
        status: normalizedStatus,
        provider_status: status,
      };

      // Se next_payment_date veio do evento, sincronizar na assinatura
      if (eventData.next_payment_date) {
        subscriptionUpdateData.next_payment_date = new Date(
          eventData.next_payment_date,
        );
      }

      await prisma.alunoSubscription.update({
        where: { id: subscription.id },
        data: subscriptionUpdateData,
      });

      // Quando pagamento confirmado, avancar planDueDate conforme o intervalo do plano.
      if (normalizedStatus === "authorized") {
        let newDueDate;
        if (eventData.next_payment_date) {
          newDueDate = new Date(eventData.next_payment_date);
        } else {
          const currentDue = subscription.aluno.planDueDate
            ? new Date(subscription.aluno.planDueDate)
            : new Date();
          newDueDate = getNextDueDateAfterPayment(
            currentDue,
            subscription.alunoPlan,
          );
        }
        await prisma.aluno.update({
          where: { id: subscription.alunoId },
          data: { planDueDate: newDueDate },
        });
        logPayment("webhook-updated-plan-due-date", {
          alunoId: subscription.alunoId,
          newDueDate,
        });
      }
    }

    logPayment("webhook-processed", {
      eventId,
      subscriptionId: subscription.id,
      alunoId: subscription.alunoId,
      personalId,
      newStatus: normalizeSubscriptionStatus(status),
    });

    return { subscription, event };
  } catch (error) {
    logPayment("webhook-process-error", {
      eventId,
      error: error.message,
    });
    throw error;
  }
}

module.exports = {
  mapSubscriptionStatusForFrontend,
  listPublicSubscriptionPlans,
  syncAlunoPlanWithMercadoPago,
  createSubscription,
  createPixSubscription,
  createPixCharge,
  getSubscriptionStatus,
  cancelSubscription,
  nextIdempotencyKey,
  processWebhookEvent,
};
