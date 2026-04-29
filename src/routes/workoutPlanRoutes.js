const { Router } = require("express");
const { requireAuth } = require("../middlewares/authMiddleware");
const { allowRoles } = require("../middlewares/roleMiddleware");

function createWorkoutPlanRoutes(workoutPlanController) {
  const router = Router();

  router.get(
    "/",
    requireAuth,
    allowRoles("PERSONAL"),
    workoutPlanController.listByAluno,
  );
  router.post(
    "/",
    requireAuth,
    allowRoles("PERSONAL"),
    workoutPlanController.create,
  );
  router.get(
    "/:id",
    requireAuth,
    allowRoles("PERSONAL"),
    workoutPlanController.getById,
  );
  router.patch(
    "/:id",
    requireAuth,
    allowRoles("PERSONAL"),
    workoutPlanController.update,
  );

  return router;
}

module.exports = { createWorkoutPlanRoutes };
