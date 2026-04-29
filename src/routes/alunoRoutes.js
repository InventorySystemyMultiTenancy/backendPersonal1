const { Router } = require("express");
const { requireAuth } = require("../middlewares/authMiddleware");
const { allowRoles } = require("../middlewares/roleMiddleware");

function createAlunoRoutes(alunoController) {
  const router = Router();

  router.get("/", requireAuth, allowRoles("PERSONAL"), alunoController.getAll);
  router.get("/me", requireAuth, allowRoles("ALUNO"), alunoController.getMe);
  router.post("/", requireAuth, allowRoles("PERSONAL"), alunoController.create);

  return router;
}

module.exports = { createAlunoRoutes };
