import {
  cancelSubscription,
  createSubscription,
  getSubscriptionStatus,
  listPublicSubscriptionPlans,
  syncAlunoPlanWithMercadoPago,
  mapSubscriptionStatusForFrontend,
  nextIdempotencyKey,
  processWebhookEvent,
} from '../services/paymentRecurringService.js';

const PAYMENT_DEBUG_LOGS = String(process.env.PAYMENT_DEBUG_LOGS || '').trim() === 'true';

function paymentDebugLog(event, payload) {
  if (!PAYMENT_DEBUG_LOGS) return;
  console.log(`[payments:controller:${event}]`, JSON.stringify(payload));
}

function getIdempotencyKey(req) {
  const fromHeader = String(req.headers['x-idempotency-key'] || '').trim();
  return fromHeader || null;
}

// GET /subscriptions/plans/:personalId - Listar planos públicos de um personal
export async function getPublicSubscriptionPlans(req, res, next) {
  try {
    const { personalId } = req.params;
    if (!personalId) {
      return res.status(400).json({ success: false, error: 'personalId obrigatório' });
    }

    const plans = await listPublicSubscriptionPlans(personalId);
    return res.status(200).json({ success: true, data: plans });
  } catch (error) {
    paymentDebugLog('list-plans:error', { message: error.message });
    return next(error);
  }
}

// POST /subscriptions/sync-plan/:alunoPlanId - Sincronizar plano com Mercado Pago
export async function postSyncPlan(req, res, next) {
  try {
    if (req.user.role !== 'PERSONAL') {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const { alunoPlanId } = req.params;
    if (!alunoPlanId) {
      return res.status(400).json({ success: false, error: 'alunoPlanId obrigatório' });
    }

    paymentDebugLog('sync-plan:request', {
      alunoPlanId,
      personalId: req.user.id,
    });

    const result = await syncAlunoPlanWithMercadoPago({
      alunoPlanId,
      personalId: req.user.personalId || req.user.id,
    });

    paymentDebugLog('sync-plan:success', {
      alunoPlanId,
      mp_plan_id: result.plan.mp_plan_id,
      alreadySynced: result.alreadySynced,
    });

    return res.status(200).json({ 
      success: true, 
      data: result.plan,
      alreadySynced: result.alreadySynced 
    });
  } catch (error) {
    paymentDebugLog('sync-plan:error', { message: error.message });
    return next(error);
  }
}

// POST /subscriptions - Criar assinatura para aluno
export async function postCreateSubscription(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Autenticação obrigatória' });
    }

    paymentDebugLog('create-subscription:request', {
      user_id: req.user?.id || null,
      aluno_id: req.body?.aluno_id || null,
      aluno_plan_id: req.body?.aluno_plan_id || null,
      has_card_token: !!req.body?.card_token_id,
    });

    const result = await createSubscription({
      alunoId: req.body.aluno_id,
      alunoPlanId: req.body.aluno_plan_id,
      payerEmail: req.body.payer_email || req.user.email,
      cardTokenId: req.body.card_token_id,
      personalId: req.user.personalId || req.user.id, // Passar personalId para validação
    });

    paymentDebugLog('create-subscription:success', {
      subscription_id: result?.subscription?.id || null,
      status: result?.subscription?.status,
    });

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    paymentDebugLog('create-subscription:error', {
      message: error.message,
    });
    return next(error);
  }
}

// GET /subscriptions/:subscriptionId - Consultar status da assinatura
export async function getSubscription(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Autenticação obrigatória' });
    }

    const { subscriptionId } = req.params;
    if (!subscriptionId) {
      return res.status(400).json({ success: false, error: 'subscriptionId obrigatório' });
    }

    const result = await getSubscriptionStatus({
      alunoId: req.user.id,
      subscriptionId,
      personalId: req.user.personalId || req.user.id, // Passar personalId para validação
    });

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    paymentDebugLog('get-subscription:error', { message: error.message });
    return next(error);
  }
}

// POST /subscriptions/:subscriptionId/cancel - Cancelar assinatura
export async function postCancelSubscription(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Autenticação obrigatória' });
    }

    const { subscriptionId } = req.params;
    if (!subscriptionId) {
      return res.status(400).json({ success: false, error: 'subscriptionId obrigatório' });
    }

    const result = await cancelSubscription({
      alunoId: req.user.id,
      subscriptionId,
      personalId: req.user.personalId || req.user.id, // Passar personalId para validação
    });

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    paymentDebugLog('cancel-subscription:error', { message: error.message });
    return next(error);
  }
}

// POST /webhooks/mercadopago - Webhook do Mercado Pago
export function postMercadoPagoWebhook(req, res, _next) {
  res.status(200).json({
    received: true,
    channel: 'webhook',
  });

  setImmediate(async () => {
    try {
      const eventId = req.query?.id || req.body?.data?.id;
      const topic = req.query?.topic || req.body?.topic;

      paymentDebugLog('webhook-received', {
        topic,
        eventId,
      });

      if (!eventId) {
        paymentDebugLog('webhook-invalid', { reason: 'Missing event ID' });
        return;
      }

      // Processar evento com validação de multi-tenant
      const result = await processWebhookEvent({
        eventId,
        eventData: {
          ...req.body?.data,
          topic,
          id: eventId,
        },
      });

      if (result) {
        paymentDebugLog('webhook-processed', {
          eventId,
          subscriptionId: result.subscription.id,
          personalId: result.subscription.aluno.personalId,
        });
      }
    } catch (error) {
      console.error('[payments:webhook-error]', error.message);
    }
  });
}
