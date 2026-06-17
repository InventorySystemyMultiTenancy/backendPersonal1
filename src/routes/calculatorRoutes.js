const { Router } = require("express");
const { requireAuth } = require("../middlewares/authMiddleware");
const { allowRoles } = require("../middlewares/roleMiddleware");

function createCalculatorRoutes(calculatorController) {
  const router = Router();

  router.use(requireAuth, allowRoles("PERSONAL", "ALUNO"));

  router.post(
    "/physical-assessment",
    calculatorController.calculatePhysicalAssessment,
  );
  router.post(
    "/running/performance",
    calculatorController.estimateRunningPerformance,
  );
  router.post("/running/pace", calculatorController.calculateRunningPace);
  router.post("/running/calories", calculatorController.calculateRunningCalories);
  router.post("/running/distance", calculatorController.convertRunningDistance);

  return router;
}

module.exports = { createCalculatorRoutes };
