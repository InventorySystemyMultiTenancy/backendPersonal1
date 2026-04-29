const { Router } = require("express");
const { requireAuth } = require("../middlewares/authMiddleware");
const { allowRoles } = require("../middlewares/roleMiddleware");

function createAlunoPlanRoutes(alunoPlanController) {
  const router = Router();

  router.get("/public", alunoPlanController.getPublicPlans);
  router.get(
    "/",
    requireAuth,
    allowRoles("PERSONAL"),
    alunoPlanController.list,
  );
  router.post(
    "/",
    requireAuth,
    allowRoles("PERSONAL"),
    alunoPlanController.create,
  );
  router.patch(
    "/:id",
    requireAuth,
    allowRoles("PERSONAL"),
    alunoPlanController.update,
  );
  router.patch(
    "/assign/:alunoId",
    requireAuth,
    allowRoles("PERSONAL"),
    alunoPlanController.assignToAluno,
  );
  router.post(
    "/me/assign",
    requireAuth,
    allowRoles("ALUNO"),
    alunoPlanController.assignToMe,
  );

  return router;
}

module.exports = { createAlunoPlanRoutes };
