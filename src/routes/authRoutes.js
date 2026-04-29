const { Router } = require("express");

function createAuthRoutes(authController) {
  const router = Router();

  router.post("/login", authController.login);

  return router;
}

module.exports = { createAuthRoutes };
