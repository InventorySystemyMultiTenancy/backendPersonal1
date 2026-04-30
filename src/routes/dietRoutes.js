const { Router } = require("express");
const { requireAuth } = require("../middlewares/authMiddleware");
const { allowRoles } = require("../middlewares/roleMiddleware");

function createDietRoutes(dietController) {
  const router = Router();

  router.get(
    "/",
    requireAuth,
    allowRoles("PERSONAL"),
    dietController.listForPersonal,
  );
  router.get("/me", requireAuth, allowRoles("ALUNO"), dietController.listForMe);
  router.post("/", requireAuth, allowRoles("PERSONAL"), dietController.create);
  router.patch(
    "/:id",
    requireAuth,
    allowRoles("PERSONAL"),
    dietController.update,
  );
  router.delete(
    "/:id",
    requireAuth,
    allowRoles("PERSONAL"),
    dietController.remove,
  );

  return router;
}

module.exports = { createDietRoutes };
