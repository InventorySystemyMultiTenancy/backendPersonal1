const { Router } = require("express");
const { requireAuth } = require("../middlewares/authMiddleware");
const { allowRoles } = require("../middlewares/roleMiddleware");

function createWorkoutSessionRoutes(workoutSessionController) {
  const router = Router();

  router.get(
    "/",
    requireAuth,
    allowRoles("PERSONAL"),
    workoutSessionController.listForPersonal,
  );

  router.get(
    "/me",
    requireAuth,
    allowRoles("ALUNO"),
    workoutSessionController.listForMe,
  );

  router.post(
    "/start",
    requireAuth,
    allowRoles("ALUNO"),
    workoutSessionController.start,
  );

  router.post(
    "/finish",
    requireAuth,
    allowRoles("ALUNO"),
    workoutSessionController.finish,
  );

  return router;
}

module.exports = { createWorkoutSessionRoutes };
