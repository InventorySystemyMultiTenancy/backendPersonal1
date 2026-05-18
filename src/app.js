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
const { createWorkoutSessionRoutes } = require("./routes/workoutSessionRoutes");
const { createCustomExerciseRoutes } = require("./routes/customExerciseRoutes");
const { createSuperAdminRoutes } = require("./routes/superAdminRoutes");
const { createHealthRoutes } = require("./routes/healthRoutes");
const { createTenantRoutes } = require("./routes/tenantRoutes");
const { createAgendaRoutes } = require("./routes/agendaRoutes");
const { createDietRoutes } = require("./routes/dietRoutes");
const { createPersonalEventRoutes } = require("./routes/personalEventRoutes");
const { createTranslationRoutes } = require("./routes/translationRoutes");
const {
  createPaymentRecurringRoutes,
} = require("./routes/paymentRecurringRoutes");
const { createMessageRoutes } = require("./routes/messageRoutes");
const {
  createPhysicalAssessmentRoutes,
} = require("./routes/physicalAssessmentRoutes");

function createApp() {
  const app = express();
  const {
    authController,
    alunoController,
    alunoPlanController,
    superAdminController,
    subscriptionController,
    workoutPlanController,
    workoutSessionController,
    customExerciseController,
    tenantController,
    agendaController,
    dietController,
    personalEventController,
    messageController,
    physicalAssessmentController,
  } = buildContainer();

  // Increase payload size limit for base64 photo uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
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
  app.use(
    "/workout-sessions",
    createWorkoutSessionRoutes(workoutSessionController),
  );
  app.use(
    "/custom-exercises",
    createCustomExerciseRoutes(customExerciseController),
  );
  app.use("/agenda", createAgendaRoutes(agendaController));
  app.use("/diets", createDietRoutes(dietController));
  app.use("/personal-events", createPersonalEventRoutes(personalEventController));
  app.use("/messages", createMessageRoutes(messageController));
  app.use(
    "/assessments",
    createPhysicalAssessmentRoutes(physicalAssessmentController),
  );
  app.use("/traducoes", createTranslationRoutes());
  app.use("/api/traducoes", createTranslationRoutes());
  app.use("/super-admin", createSuperAdminRoutes(superAdminController));
  app.use("/tenants", createTenantRoutes(tenantController));

  // Mercado Pago recorrente
  app.use("/payments/recurring", createPaymentRecurringRoutes());
  // Compatibilidade para clientes que usam prefixo /api
  app.use("/api/payments/recurring", createPaymentRecurringRoutes());

  app.use(errorMiddleware);

  return app;
}

module.exports = { createApp };
