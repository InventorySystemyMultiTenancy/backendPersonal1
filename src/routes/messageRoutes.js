const { Router } = require("express");
const { requireAuth } = require("../middlewares/authMiddleware");
const { allowRoles } = require("../middlewares/roleMiddleware");

function createMessageRoutes(messageController) {
  const router = Router();

  // Aluno endpoints
  router.get(
    "/me",
    requireAuth,
    allowRoles("ALUNO"),
    messageController.listForMe,
  );
  router.post(
    "/me",
    requireAuth,
    allowRoles("ALUNO"),
    messageController.sendAsAluno,
  );

  // Personal endpoints (must come after /me to avoid conflict)
  router.get(
    "/:alunoId",
    requireAuth,
    allowRoles("PERSONAL"),
    messageController.listThread,
  );
  router.post(
    "/:alunoId",
    requireAuth,
    allowRoles("PERSONAL"),
    messageController.sendAsPersonal,
  );

  // Admin cleanup endpoint (PERSONAL role only, as they manage the account)
  router.post(
    "/admin/cleanup",
    requireAuth,
    allowRoles("PERSONAL"),
    messageController.cleanupOldMessages,
  );

  return router;
}

module.exports = { createMessageRoutes };
