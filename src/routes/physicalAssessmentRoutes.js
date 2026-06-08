const { Router } = require("express");
const { requireAuth } = require("../middlewares/authMiddleware");
const { allowRoles } = require("../middlewares/roleMiddleware");

function createPhysicalAssessmentRoutes(controller) {
  const router = Router();

  // List by aluno (personal can list any, aluno only their own via /me frontend)
  router.get(
    "/aluno/:alunoId",
    requireAuth,
    allowRoles("PERSONAL", "ALUNO"),
    controller.listByAluno,
  );

  // Create assessment
  router.post(
    "/",
    requireAuth,
    allowRoles("PERSONAL", "ALUNO"),
    controller.create,
  );

  // Delete assessment
  router.delete("/:id", requireAuth, allowRoles("PERSONAL"), controller.remove);

  return router;
}

module.exports = { createPhysicalAssessmentRoutes };
