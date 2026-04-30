const {
  cancelSubscription,
  createSubscription,
  getSubscriptionStatus,
  listPublicSubscriptionPlans,
  syncAlunoPlanWithMercadoPago,
  mapSubscriptionStatusForFrontend,
  nextIdempotencyKey,
  processWebhookEvent,
} = require('../services/paymentRecurringService');

const PAYMENT_DEBUG_LOGS = String(process.env.PAYMENT_DEBUG_LOGS || '').trim() === 'true';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function paymentDebugLog(event, payload) {
  if (!PAYMENT_DEBUG_LOGS) return;
  console.log(`[payments:controller:${event}]`, JSON.stringify(payload));
}

function getIdempotencyKey(req) {
  const fromHeader = String(req.headers['x-idempotency-key'] || '').trim();
  return fromHeader || null;
}

// GET /subscriptions/plans/:personalId - Listar planos públicos de um personal
async function getPublicSubscriptionPlans(req, res, next) {
  try {
    const { personalId } = req.params;
    paymentDebugLog('list-plans:request', {
      path: req.originalUrl,
      personalIdParam: req.params?.personalId || null,
      personalIdQuery: req.query?.personalId || null,
      personalIdHeader: req.headers['x-personal-id'] || null,
    });

    if (!personalId) {
      paymentDebugLog('list-plans:missing-personal-id', {
        path: req.originalUrl,
      });
      return res.status(400).json({ success: false, error: 'personalId obrigatório' });
    }

    if (!UUID_REGEX.test(String(personalId).trim())) {
      paymentDebugLog('list-plans:invalid-personal-id', {
        personalId,
        path: req.originalUrl,
      });
      return res.status(400).json({
        success: false,
        error: 'personalId inválido. Envie um UUID válido.',
      });
    }

    const plans = await listPublicSubscriptionPlans(personalId);
    paymentDebugLog('list-plans:result', {
      personalId,
      plansCount: plans.length,
      hasAnyWithoutMpId: plans.some((p) => !p.preapproval_plan_id),
    });

    if (!plans.length) {
      paymentDebugLog('list-plans:empty', {
        personalId,
        hint: 'Nenhum AlunoPlan ativo e sincronizado (mp_plan_id) encontrado para este personal',
      });
    }

    return res.status(200).json({ success: true, data: plans });
  } catch (error) {
    paymentDebugLog('list-plans:error', { message: error.message });
    return next(error);
  }
}

// Compatibilidade: GET /subscriptions/plans/public?personalId=<id>
async function getPublicSubscriptionPlansLegacy(req, res, next) {
  const fromQuery = req.query?.personalId;
  const fromHeader = req.headers['x-personal-id'];
  req.params.personalId = fromQuery || fromHeader;
  paymentDebugLog('list-plans-legacy:resolved-personal-id', {
    path: req.originalUrl,
    source: fromQuery ? 'query' : fromHeader ? 'header' : 'none',
    resolvedPersonalId: req.params.personalId || null,
  });
  return getPublicSubscriptionPlans(req, res, next);
}

// POST /subscriptions/sync-plan/:alunoPlanId - Sincronizar plano com Mercado Pago
async function postSyncPlan(req, res, next) {
  try {
    if (!req.auth || req.auth.role !== 'PERSONAL') {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const { alunoPlanId } = req.params;
    if (!alunoPlanId) {
      return res.status(400).json({ success: false, error: 'alunoPlanId obrigatório' });
    }

    paymentDebugLog('sync-plan:request', {
      alunoPlanId,
      personalId: req.auth.userId,
    });

    const result = await syncAlunoPlanWithMercadoPago({
      alunoPlanId,
      personalId: req.auth.personalId || req.auth.userId,
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
async function postCreateSubscription(req, res, next) {
  try {
    if (!req.auth) {
      return res.status(401).json({ success: false, error: 'Autenticação obrigatória' });
    }

    paymentDebugLog('create-subscription:request', {
      path: req.originalUrl,
      user_id: req.auth?.userId || null,
      personal_id: req.auth?.personalId || req.auth?.userId || null,
      aluno_id: req.body?.aluno_id || null,
      aluno_plan_id: req.body?.aluno_plan_id || null,
      has_card_token: !!req.body?.card_token_id,
      has_payer_email: Boolean(req.body?.payer_email || req.auth?.email),
    });

    const result = await createSubscription({
      alunoId: req.body.aluno_id,
      alunoPlanId: req.body.aluno_plan_id,
      payerEmail: req.body.payer_email || req.auth.email,
      cardTokenId: req.body.card_token_id,
      personalId: req.auth.personalId || req.auth.userId,
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
async function getSubscription(req, res, next) {
  try {
    if (!req.auth) {
      return res.status(401).json({ success: false, error: 'Autenticação obrigatória' });
    }

    const { subscriptionId } = req.params;
    if (!subscriptionId) {
      return res.status(400).json({ success: false, error: 'subscriptionId obrigatório' });
    }

    const result = await getSubscriptionStatus({
      alunoId: req.auth.userId,
      subscriptionId,
      personalId: req.auth.personalId || req.auth.userId,
    });

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    paymentDebugLog('get-subscription:error', { message: error.message });
    return next(error);
  }
}

// POST /subscriptions/:subscriptionId/cancel - Cancelar assinatura
async function postCancelSubscription(req, res, next) {
  try {
    if (!req.auth) {
      return res.status(401).json({ success: false, error: 'Autenticação obrigatória' });
    }

    const { subscriptionId } = req.params;
    if (!subscriptionId) {
      return res.status(400).json({ success: false, error: 'subscriptionId obrigatório' });
    }

    const result = await cancelSubscription({
      alunoId: req.auth.userId,
      subscriptionId,
      personalId: req.auth.personalId || req.auth.userId,
    });

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    paymentDebugLog('cancel-subscription:error', { message: error.message });
    return next(error);
  }
}

// POST /webhooks/mercadopago - Webhook do Mercado Pago
function postMercadoPagoWebhook(req, res, _next) {
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

module.exports = {
  getPublicSubscriptionPlans,
  getPublicSubscriptionPlansLegacy,
  postSyncPlan,
  postCreateSubscription,
  getSubscription,
  postCancelSubscription,
  postMercadoPagoWebhook,
};
