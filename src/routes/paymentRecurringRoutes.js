const { Router } = require('express');
const {
  getPublicSubscriptionPlans,
  getPublicSubscriptionPlansLegacy,
  postCreateSubscription,
  postSyncPlan,
  getSubscription,
  postCancelSubscription,
  postMercadoPagoWebhook,
} = require('../controllers/paymentRecurringController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { allowRoles } = require('../middlewares/roleMiddleware');

const router = Router();

const PAYMENT_DEBUG_LOGS = String(process.env.PAYMENT_DEBUG_LOGS || '').trim() === 'true';

router.use((req, _res, next) => {
  if (PAYMENT_DEBUG_LOGS) {
    console.log('[payments:route-hit]', JSON.stringify({
      method: req.method,
      path: req.originalUrl,
      routePath: req.path,
      personalIdParam: req.params?.personalId || null,
      personalIdQuery: req.query?.personalId || null,
      personalIdHeader: req.headers['x-personal-id'] || null,
      hasAuthHeader: Boolean(req.headers.authorization),
    }));
  }
  next();
});

// Webhook do Mercado Pago (sem autenticação)
router.post('/webhooks/mercadopago', postMercadoPagoWebhook);

// Compatibilidade com frontend legado
router.get('/subscriptions/plans/public', getPublicSubscriptionPlansLegacy);

// Planos públicos (sem autenticação, precisa do personalId)
router.get('/subscriptions/plans/:personalId', getPublicSubscriptionPlans);

// Rotas com autenticação
router.post('/subscriptions/sync-plan/:alunoPlanId', requireAuth, allowRoles('PERSONAL'), postSyncPlan);

router.post('/subscriptions', requireAuth, postCreateSubscription);
router.get('/subscriptions/:subscriptionId', requireAuth, getSubscription);
router.post('/subscriptions/:subscriptionId/cancel', requireAuth, postCancelSubscription);
router.delete('/subscriptions/:subscriptionId/cancel', requireAuth, postCancelSubscription);

module.exports = { createPaymentRecurringRoutes: () => router };
