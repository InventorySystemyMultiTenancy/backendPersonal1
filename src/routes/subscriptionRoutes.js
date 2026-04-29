const { Router } = require("express");
const { requireAuth } = require("../middlewares/authMiddleware");
const { allowRoles } = require("../middlewares/roleMiddleware");

function createSubscriptionRoutes(subscriptionController) {
  const router = Router();

  router.get("/plans/public", subscriptionController.getPublicPlans);

  router.post(
    "/",
    requireAuth,
    allowRoles("PERSONAL"),
    subscriptionController.createSubscription,
  );

  router.get(
    "/me",
    requireAuth,
    allowRoles("PERSONAL"),
    subscriptionController.getMySubscription,
  );

  router.get(
    "/:reference",
    requireAuth,
    allowRoles("PERSONAL"),
    subscriptionController.getSubscription,
  );

  router.post(
    "/:reference/cancel",
    requireAuth,
    allowRoles("PERSONAL"),
    subscriptionController.cancelSubscription,
  );

  router.delete(
    "/:reference/cancel",
    requireAuth,
    allowRoles("PERSONAL"),
    subscriptionController.cancelSubscription,
  );

  return router;
}

module.exports = { createSubscriptionRoutes };
