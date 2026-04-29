const { prisma } = require("../db/prisma");
const { UserRepository } = require("../repositories/userRepository");
const { AlunoRepository } = require("../repositories/alunoRepository");
const { PersonalRepository } = require("../repositories/personalRepository");
const {
  SubscriptionPlanRepository,
} = require("../repositories/subscriptionPlanRepository");
const {
  TenantSubscriptionRepository,
} = require("../repositories/tenantSubscriptionRepository");
const { AlunoPlanRepository } = require("../repositories/alunoPlanRepository");
const {
  WorkoutPlanRepository,
} = require("../repositories/workoutPlanRepository");
const { AuthService } = require("../services/authService");
const { AlunoService } = require("../services/alunoService");
const { SuperAdminService } = require("../services/superAdminService");
const { SubscriptionService } = require("../services/subscriptionService");
const { AlunoPlanService } = require("../services/alunoPlanService");
const { WorkoutPlanService } = require("../services/workoutPlanService");
const { AuthController } = require("../controllers/authController");
const { AlunoController } = require("../controllers/alunoController");
const { SuperAdminController } = require("../controllers/superAdminController");
const {
  SubscriptionController,
} = require("../controllers/subscriptionController");
const { AlunoPlanController } = require("../controllers/alunoPlanController");
const {
  WorkoutPlanController,
} = require("../controllers/workoutPlanController");

function buildContainer() {
  const userRepository = new UserRepository(prisma);
  const alunoRepository = new AlunoRepository(prisma);
  const personalRepository = new PersonalRepository(prisma);
  const subscriptionPlanRepository = new SubscriptionPlanRepository(prisma);
  const tenantSubscriptionRepository = new TenantSubscriptionRepository(prisma);
  const alunoPlanRepository = new AlunoPlanRepository(prisma);
  const workoutPlanRepository = new WorkoutPlanRepository(prisma);

  const authService = new AuthService(userRepository);
  const alunoService = new AlunoService(alunoRepository);
  const superAdminService = new SuperAdminService(personalRepository);
  const subscriptionService = new SubscriptionService(
    subscriptionPlanRepository,
    tenantSubscriptionRepository,
  );
  const alunoPlanService = new AlunoPlanService(
    alunoPlanRepository,
    alunoRepository,
  );
  const workoutPlanService = new WorkoutPlanService(
    workoutPlanRepository,
    alunoRepository,
  );

  const authController = new AuthController(authService);
  const alunoController = new AlunoController(alunoService);
  const superAdminController = new SuperAdminController(superAdminService);
  const subscriptionController = new SubscriptionController(
    subscriptionService,
  );
  const alunoPlanController = new AlunoPlanController(alunoPlanService);
  const workoutPlanController = new WorkoutPlanController(workoutPlanService);

  return {
    authController,
    alunoController,
    superAdminController,
    subscriptionController,
    alunoPlanController,
    workoutPlanController,
  };
}

module.exports = { buildContainer };
