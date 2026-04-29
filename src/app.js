const express = require("express");
const { buildContainer } = require("./di/container");
const { requestContextMiddleware } = require("./context/requestContext");
const { authMiddleware } = require("./middlewares/authMiddleware");
const { errorMiddleware } = require("./middlewares/errorMiddleware");
const { createAuthRoutes } = require("./routes/authRoutes");
const { createAlunoRoutes } = require("./routes/alunoRoutes");
const { createAlunoPlanRoutes } = require("./routes/alunoPlanRoutes");
const { createSubscriptionRoutes } = require("./routes/subscriptionRoutes");
const { createWorkoutPlanRoutes } = require("./routes/workoutPlanRoutes");
const { createSuperAdminRoutes } = require("./routes/superAdminRoutes");
const { createHealthRoutes } = require("./routes/healthRoutes");

function createApp() {
  const app = express();
  const {
    authController,
    alunoController,
    alunoPlanController,
    superAdminController,
    subscriptionController,
    workoutPlanController,
  } = buildContainer();

  app.use(express.json());
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, x-personal-id",
    );
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PATCH, DELETE, OPTIONS",
    );

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }

    return next();
  });
  app.use(requestContextMiddleware);
  app.use(authMiddleware);

  app.use("/health", createHealthRoutes());
  app.use("/auth", createAuthRoutes(authController));
  app.use("/alunos", createAlunoRoutes(alunoController));
  app.use("/aluno-plans", createAlunoPlanRoutes(alunoPlanController));
  app.use("/subscriptions", createSubscriptionRoutes(subscriptionController));
  app.use("/workout-plans", createWorkoutPlanRoutes(workoutPlanController));
  app.use("/super-admin", createSuperAdminRoutes(superAdminController));

  app.use(errorMiddleware);

  return app;
}

module.exports = { createApp };
