const { Router } = require("express");
const { requireAuth } = require("../middlewares/authMiddleware");
const { allowRoles } = require("../middlewares/roleMiddleware");

function createSuperAdminRoutes(superAdminController) {
  const router = Router();

  router.get(
    "/dashboard/metrics",
    requireAuth,
    allowRoles("SUPER_ADMIN"),
    superAdminController.getDashboardMetrics,
  );

  router.get(
    "/dashboard/growth",
    requireAuth,
    allowRoles("SUPER_ADMIN"),
    superAdminController.getDashboardGrowth,
  );

  router.get(
    "/activity",
    requireAuth,
    allowRoles("SUPER_ADMIN"),
    superAdminController.getRecentActivity,
  );

  router.get(
    "/tenants/billing",
    requireAuth,
    allowRoles("SUPER_ADMIN"),
    superAdminController.getBillingReport,
  );

  router.get(
    "/plans/summary",
    requireAuth,
    allowRoles("SUPER_ADMIN"),
    superAdminController.getPlansSummary,
  );

  router.get(
    "/tenants",
    requireAuth,
    allowRoles("SUPER_ADMIN"),
    superAdminController.getTenants,
  );

  router.patch(
    "/tenants/:personalId/status",
    requireAuth,
    allowRoles("SUPER_ADMIN"),
    superAdminController.updateTenantStatus,
  );

  return router;
}

module.exports = { createSuperAdminRoutes };
