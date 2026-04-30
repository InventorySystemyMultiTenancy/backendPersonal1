import { Router } from 'express';
import {
  getPublicSubscriptionPlans,
  postCreateSubscription,
  postSyncPlan,
  getSubscription,
  postCancelSubscription,
  postMercadoPagoWebhook,
} from '../controllers/paymentRecurringController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

const PAYMENT_DEBUG_LOGS = String(process.env.PAYMENT_DEBUG_LOGS || '').trim() === 'true';

router.use((req, _res, next) => {
  if (PAYMENT_DEBUG_LOGS) {
    console.log('[payments:route-hit]', JSON.stringify({
      method: req.method,
      path: req.originalUrl,
    }));
  }
  next();
});

// Webhook do Mercado Pago (sem autenticação)
router.post('/webhooks/mercadopago', postMercadoPagoWebhook);

// Planos públicos (sem autenticação, precisa do personalId)
router.get('/subscriptions/plans/:personalId', getPublicSubscriptionPlans);

// Rotas com autenticação
router.post('/subscriptions/sync-plan/:alunoPlanId', authMiddleware, postSyncPlan);

router.post('/subscriptions', authMiddleware, postCreateSubscription);
router.get('/subscriptions/:subscriptionId', authMiddleware, getSubscription);
router.post('/subscriptions/:subscriptionId/cancel', authMiddleware, postCancelSubscription);
router.delete('/subscriptions/:subscriptionId/cancel', authMiddleware, postCancelSubscription);

export default router;
