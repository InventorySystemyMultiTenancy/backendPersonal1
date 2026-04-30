import { randomUUID } from 'node:crypto';
import { prisma } from '../db/prisma.js';

const MP_API_BASE_URL = String(process.env.MP_API_BASE_URL || 'https://api.mercadopago.com').trim();
const MP_REQUEST_TIMEOUT_MS = Number(process.env.MP_REQUEST_TIMEOUT_MS || 10000);
const MP_MAX_RETRIES = Number(process.env.MP_MAX_RETRIES || 2);
const PAYMENT_DEBUG_LOGS = String(process.env.PAYMENT_DEBUG_LOGS || '').trim() === 'true';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function logPayment(event, payload) {
  if (!PAYMENT_DEBUG_LOGS) return;
  console.log(`[payments:${event}]`, JSON.stringify(payload));
}

function sanitizeAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Valor de pagamento inválido');
  }
  return Number(amount.toFixed(2));
}

function normalizeNullable(value) {
  const text = String(value || '').trim();
  return text ? text : null;
}

function normalizeSubscriptionStatus(rawStatus, fallback = 'pending') {
  const status = String(rawStatus || '').trim().toLowerCase();
  if (!status) return fallback;
  if (status === 'authorized' || status === 'active') return 'authorized';
  if (status === 'paused' || status === 'suspended') return 'paused';
  if (status === 'cancelled' || status === 'canceled') return 'canceled';
  if (status === 'pending') return 'pending';
  return fallback;
}

export function mapSubscriptionStatusForFrontend(rawStatus) {
  return normalizeSubscriptionStatus(rawStatus, 'unknown');
}

function isValidEmail(email) {
  const text = String(email || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}

function normalizeFrequency(value = 1) {
  const number = Number(value ?? 1);
  return !Number.isInteger(number) || number <= 0 ? 1 : number;
}

function ensureMercadoPagoToken() {
  const token = normalizeNullable(process.env.MERCADO_PAGO_ACCESS_TOKEN);
  if (!token) {
    throw new Error('Access Token do Mercado Pago não configurado');
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
  method = 'GET',
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
        headers['Content-Type'] = 'application/json';
      }

      if (idempotencyKey) {
        headers['X-Idempotency-Key'] = idempotencyKey;
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

      if ((response.status >= 500 || response.status === 429) && attempt < retries) {
        await sleep(200 * (attempt + 1));
        continue;
      }

      throw new Error(`Erro Mercado Pago (${response.status}): ${data?.message || 'Erro desconhecido'}`);
    } catch (error) {
      const shouldRetry = (error.name === 'AbortError' || error.code === 'ECONNRESET') && attempt < retries;
      if (shouldRetry) {
        await sleep(200 * (attempt + 1));
        continue;
      }
      if (error.name === 'AbortError') {
        throw new Error('Timeout ao comunicar com Mercado Pago');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error('Falha de comunicação com Mercado Pago');
}

function toSubscriptionExternalReference(alunoId) {
  return `subscription:${alunoId}`;
}

function ensureSubscriptionEmail(email) {
  const normalized = normalizeNullable(email);
  if (!normalized) throw new Error('Email do assinante obrigatório');
  if (!isValidEmail(normalized)) throw new Error('Email do assinante inválido');
  return normalized;
}

// List Public Plans - Retorna planos Ativos que já têm mp_plan_id sincronizado
export async function listPublicSubscriptionPlans(personalId) {
  const plans = await prisma.alunoPlan.findMany({
    where: { 
      personalId,
      isActive: true,
      mp_plan_id: { not: null } // Apenas planos sincronizados
    },
    orderBy: { monthlyPriceCents: 'asc' },
  });

  return plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    description: plan.description || null,
    transaction_amount: plan.monthlyPriceCents / 100,
    frequency: 1,
    frequency_type: 'months',
    currency_id: 'BRL',
    preapproval_plan_id: plan.mp_plan_id,
  }));
}

// Sincronizar um plano do banco com Mercado Pago
export async function syncAlunoPlanWithMercadoPago({ alunoPlanId, personalId }) {
  const plan = await prisma.alunoPlan.findUnique({
    where: { id: alunoPlanId },
  });

  if (!plan || plan.personalId !== personalId) {
    throw new Error('Plano não encontrado');
  }

  if (plan.mp_plan_id) {
    // Já sincronizado
    return { plan, alreadySynced: true };
  }

  const token = ensureMercadoPagoToken();
  const transactionAmount = sanitizeAmount(plan.monthlyPriceCents / 100);

  try {
    const created = await mercadoPagoRequest({
      path: '/preapproval_plan',
      method: 'POST',
      token,
      idempotencyKey: `plan:${plan.id}:${plan.name}`,
      payload: {
        reason: plan.name,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: transactionAmount,
          currency_id: 'BRL',
        },
        back_url: process.env.FRONTEND_URL || 'https://seusite.com.br',
      },
    });

    const mpPlanId = String(created?.id || '').trim();

    // Atualizar plano com ID do MP
    const updated = await prisma.alunoPlan.update({
      where: { id: alunoPlanId },
      data: {
        mp_plan_id: mpPlanId,
        mp_sync_status: 'synced',
        mp_synced_at: new Date(),
      },
    });

    logPayment('sync-plan-success', {
      alunoPlanId,
      plan_name: plan.name,
      mp_plan_id: mpPlanId,
    });

    return { plan: updated, alreadySynced: false };
  } catch (error) {
    // Registrar erro de sincronização
    await prisma.alunoPlan.update({
      where: { id: alunoPlanId },
      data: {
        mp_sync_status: 'error',
        mp_sync_error: error.message,
      },
    });

    logPayment('sync-plan-error', {
      alunoPlanId,
      error: error.message,
    });

    throw error;
  }
}

// Criar assinatura para aluno com plano existente
export async function createSubscription({
  alunoId,
  alunoPlanId,
  payerEmail,
  cardTokenId,
  personalId, // REQUIRED: validação de multi-tenant
}) {
  const token = ensureMercadoPagoToken();
  const finalEmail = ensureSubscriptionEmail(payerEmail);
  const finalToken = normalizeNullable(cardTokenId);

  if (!finalToken) {
    throw new Error('card_token_id obrigatório');
  }

  if (!personalId) {
    throw new Error('personalId obrigatório para validação');
  }

  // Verificar aluno
  const aluno = await prisma.aluno.findUnique({
    where: { id: alunoId },
    include: { alunoPlan: true },
  });

  if (!aluno) {
    throw new Error('Aluno não encontrado');
  }

  // VALIDAÇÃO MULTI-TENANT: Aluno deve pertencer ao mesmo personal
  if (aluno.personalId !== personalId) {
    throw new Error('Aluno não pertence a este personal');
  }

  // Verificar plano
  const plan = await prisma.alunoPlan.findUnique({
    where: { id: alunoPlanId },
  });

  if (!plan || !plan.isActive || !plan.mp_plan_id) {
    throw new Error('Plano de assinatura inativo ou não sincronizado');
  }

  // VALIDAÇÃO MULTI-TENANT: Plano deve pertencer ao mesmo personal
  if (plan.personalId !== personalId) {
    throw new Error('Plano não pertence a este personal');
  }

  // Verificar se já tem assinatura ativa
  const existingSubscription = await prisma.alunoSubscription.findFirst({
    where: {
      alunoId,
      status: { in: ['pending', 'authorized'] },
    },
  });

  if (existingSubscription) {
    throw new Error('Aluno já possui uma assinatura ativa');
  }

  const finalPlanId = plan.mp_plan_id;
  const externalReference = toSubscriptionExternalReference(alunoId);

  try {
    const created = await mercadoPagoRequest({
      path: '/preapproval',
      method: 'POST',
      token,
      idempotencyKey: `subscription:${alunoId}:${finalPlanId}`,
      payload: {
        preapproval_plan_id: finalPlanId,
        payer_email: finalEmail,
        card_token_id: finalToken,
        reason: plan.name,
        status: 'authorized',
        external_reference: externalReference,
        back_url: process.env.FRONTEND_URL || 'https://seusite.com.br',
      },
    });

    const mpPreapprovalId = String(created?.id || '').trim();

    // Criar registro de assinatura
    const subscription = await prisma.alunoSubscription.create({
      data: {
        alunoId,
        alunoPlanId,
        payer_email: created?.payer_email || finalEmail,
        mp_preapproval_id: mpPreapprovalId,
        mp_plan_id: created?.preapproval_plan_id || finalPlanId,
        external_reference: created?.external_reference || externalReference,
        status: normalizeSubscriptionStatus(created?.status || 'authorized'),
        provider_status: created?.status,
        next_payment_date: created?.next_payment_date ? new Date(created.next_payment_date) : null,
        card_token_last4: created?.card_id ? String(created.card_id).slice(-4) : null,
      },
      include: { alunoPlan: true },
    });

    // Atualizar aluno com novo plano
    await prisma.aluno.update({
      where: { id: alunoId },
      data: { alunoPlanId },
    });

    logPayment('create-subscription', {
      alunoId,
      alunoPlanId,
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
    logPayment('create-subscription-error', {
      alunoId,
      error: error.message,
    });
    throw error;
  }
}

// Consultar status da assinatura
export async function getSubscriptionStatus({ alunoId, subscriptionId, personalId }) {
  const token = ensureMercadoPagoToken();

  const subscription = await prisma.alunoSubscription.findUnique({
    where: { id: subscriptionId },
    include: { alunoPlan: true, aluno: true },
  });

  if (!subscription || subscription.alunoId !== alunoId) {
    throw new Error('Assinatura não encontrada');
  }

  // VALIDAÇÃO MULTI-TENANT: Aluno deve pertencer ao mesmo personal
  if (!personalId || subscription.aluno.personalId !== personalId) {
    throw new Error('Aluno não pertence a este personal');
  }

  try {
    const provider = await mercadoPagoRequest({
      path: `/preapproval/${subscription.mp_preapproval_id}`,
      method: 'GET',
      token,
    }).catch(() => null);

    if (provider) {
      // Atualizar status local
      await prisma.alunoSubscription.update({
        where: { id: subscriptionId },
        data: {
          status: normalizeSubscriptionStatus(provider.status),
          provider_status: provider.status,
          next_payment_date: provider.next_payment_date ? new Date(provider.next_payment_date) : null,
        },
      });
    }

    return {
      subscription: {
        id: subscription.id,
        mp_preapproval_id: subscription.mp_preapproval_id,
        status: normalizeSubscriptionStatus(provider?.status || subscription.status),
        email: subscription.payer_email,
        next_payment_date: provider?.next_payment_date || subscription.next_payment_date,
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
export async function cancelSubscription({ alunoId, subscriptionId, personalId }) {
  const token = ensureMercadoPagoToken();

  const subscription = await prisma.alunoSubscription.findUnique({
    where: { id: subscriptionId },
    include: { aluno: true },
  });

  if (!subscription || subscription.alunoId !== alunoId) {
    throw new Error('Assinatura não encontrada');
  }

  // VALIDAÇÃO MULTI-TENANT: Aluno deve pertencer ao mesmo personal
  if (!personalId || subscription.aluno.personalId !== personalId) {
    throw new Error('Aluno não pertence a este personal');
  }

  if (normalizeSubscriptionStatus(subscription.status) === 'canceled') {
    throw new Error('Assinatura já cancelada');
  }

  try {
    const canceled = await mercadoPagoRequest({
      path: `/preapproval/${subscription.mp_preapproval_id}`,
      method: 'PUT',
      token,
      payload: { status: 'cancelled' },
    });

    const updated = await prisma.alunoSubscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'canceled',
        provider_status: canceled?.status || 'cancelled',
      },
    });

    // Remover plano do aluno
    await prisma.aluno.update({
      where: { id: alunoId },
      data: { alunoPlanId: null },
    });

    logPayment('cancel-subscription', {
      alunoId,
      subscriptionId,
      mp_preapproval_id: subscription.mp_preapproval_id,
    });

    return { subscription: updated, canceled: true };
  } catch (error) {
    logPayment('cancel-subscription-error', {
      subscriptionId,
      error: error.message,
    });
    throw error;
  }
}

export function nextIdempotencyKey() {
  return randomUUID();
}

// Processar evento de webhook do Mercado Pago com validação de personalId
export async function processWebhookEvent({ eventId, eventData }) {
  if (!eventId || !eventData) {
    throw new Error('Event ID e data obrigatórios');
  }

  try {
    const { preapproval_id, status, external_reference } = eventData;

    if (!preapproval_id) {
      logPayment('webhook-invalid', { eventId, reason: 'Missing preapproval_id' });
      return null;
    }

    // Encontrar assinatura pelo mp_preapproval_id
    const subscription = await prisma.alunoSubscription.findUnique({
      where: { mp_preapproval_id: preapproval_id },
      include: { aluno: true, alunoPlan: true },
    });

    if (!subscription) {
      logPayment('webhook-not-found', { eventId, preapproval_id });
      return null;
    }

    // VALIDAÇÃO: Garantir que subscription, aluno e plano têem o mesmo personalId
    const personalId = subscription.aluno.personalId;
    if (subscription.alunoPlan.personalId !== personalId) {
      logPayment('webhook-tenant-mismatch', {
        eventId,
        subscriptionId: subscription.id,
        alunoPersonalId: personalId,
        planPersonalId: subscription.alunoPlan.personalId,
      });
      throw new Error('Tenant mismatch in webhook processing');
    }

    // Registrar evento
    const event = await prisma.alunoSubscriptionEvent.create({
      data: {
        alunoSubscriptionId: subscription.id,
        eventType: eventData.topic || 'preapproval',
        providerEventKey: eventId,
        status: normalizeSubscriptionStatus(status),
        payload: eventData,
      },
    });

    // Atualizar status da assinatura se mudou
    if (status && normalizeSubscriptionStatus(status) !== normalizeSubscriptionStatus(subscription.status)) {
      await prisma.alunoSubscription.update({
        where: { id: subscription.id },
        data: {
          status: normalizeSubscriptionStatus(status),
          provider_status: status,
        },
      });
    }

    logPayment('webhook-processed', {
      eventId,
      subscriptionId: subscription.id,
      alunoId: subscription.alunoId,
      personalId,
      newStatus: normalizeSubscriptionStatus(status),
    });

    return { subscription, event };
  } catch (error) {
    logPayment('webhook-process-error', {
      eventId,
      error: error.message,
    });
    throw error;
  }
}
