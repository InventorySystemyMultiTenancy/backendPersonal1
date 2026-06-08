const { Router } = require("express");
const { requireAuth } = require("../middlewares/authMiddleware");
const { allowRoles } = require("../middlewares/roleMiddleware");

function createPersonalEventRoutes(personalEventController) {
  const router = Router();

  router.get(
    "/",
    requireAuth,
    allowRoles("PERSONAL"),
    personalEventController.listForPersonal,
  );
  router.post(
    "/",
    requireAuth,
    allowRoles("PERSONAL"),
    personalEventController.create,
  );
  router.get(
    "/me",
    requireAuth,
    allowRoles("ALUNO"),
    personalEventController.listForMe,
  );
  router.patch(
    "/:eventId/respond",
    requireAuth,
    allowRoles("ALUNO"),
    personalEventController.respond,
  );

  return router;
}

module.exports = { createPersonalEventRoutes };
