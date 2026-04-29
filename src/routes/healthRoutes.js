const { Router } = require("express");

function createHealthRoutes() {
  const router = Router();

  router.get("/", (_req, res) => {
    return res.status(200).json({
      status: "ok",
      service: "personal-saas-backend",
    });
  });

  return router;
}

module.exports = { createHealthRoutes };
