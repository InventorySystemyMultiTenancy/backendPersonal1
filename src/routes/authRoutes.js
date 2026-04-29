const { Router } = require("express");
const { requireAuth } = require("../middlewares/authMiddleware");

function createAuthRoutes(authController) {
  const router = Router();

  router.post("/login", authController.login);
  router.post("/register", authController.register);
  router.get("/me", requireAuth, authController.me);

  return router;
}

module.exports = { createAuthRoutes };
