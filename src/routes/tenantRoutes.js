const { Router } = require("express");

function createTenantRoutes(tenantController) {
  const router = Router();

  router.get("/resolve", tenantController.resolve);

  return router;
}

module.exports = { createTenantRoutes };
