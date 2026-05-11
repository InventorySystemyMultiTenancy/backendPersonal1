const { Router } = require("express");
const { requireAuth } = require("../middlewares/authMiddleware");
const { allowRoles } = require("../middlewares/roleMiddleware");

function createCustomExerciseRoutes(customExerciseController) {
  const router = Router();

  router.get(
    "/",
    requireAuth,
    allowRoles("PERSONAL"),
    customExerciseController.list,
  );

  router.get(
    "/by-group",
    requireAuth,
    allowRoles("PERSONAL"),
    customExerciseController.listByGroup,
  );

  router.post(
    "/",
    requireAuth,
    allowRoles("PERSONAL"),
    customExerciseController.create,
  );

  router.patch(
    "/:id",
    requireAuth,
    allowRoles("PERSONAL"),
    customExerciseController.update,
  );

  router.delete(
    "/:id",
    requireAuth,
    allowRoles("PERSONAL"),
    customExerciseController.delete,
  );

  return router;
}

module.exports = { createCustomExerciseRoutes };
