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
  router.get(
    "/me",
    requireAuth,
    allowRoles("ALUNO"),
    workoutPlanController.listMine,
  );
  router.post(
    "/",
    requireAuth,
    allowRoles("PERSONAL"),
    workoutPlanController.create,
  );
  // Templates routes
  router.get(
    "/templates",
    requireAuth,
    allowRoles("PERSONAL"),
    workoutPlanController.listTemplates,
  );
  router.post(
    "/templates",
    requireAuth,
    allowRoles("PERSONAL"),
    workoutPlanController.createTemplate,
  );
  router.get(
    "/templates/:id",
    requireAuth,
    allowRoles("PERSONAL"),
    workoutPlanController.getTemplateById,
  );
  router.post(
    "/templates/:id/clone",
    requireAuth,
    allowRoles("PERSONAL"),
    workoutPlanController.cloneTemplate,
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
  router.post(
    "/:id/schedule",
    requireAuth,
    allowRoles("PERSONAL"),
    workoutPlanController.schedulePlan,
  );

  return router;
}

module.exports = { createWorkoutPlanRoutes };
