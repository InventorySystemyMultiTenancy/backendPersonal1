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
const {
  CustomExerciseRepository,
} = require("../repositories/customExerciseRepository");
const {
  WorkoutSessionRepository,
} = require("../repositories/workoutSessionRepository");
const { AgendaRepository } = require("../repositories/agendaRepository");
const { DietRepository } = require("../repositories/dietRepository");
const { AuthService } = require("../services/authService");
const { AlunoService } = require("../services/alunoService");
const { SuperAdminService } = require("../services/superAdminService");
const { SubscriptionService } = require("../services/subscriptionService");
const { AlunoPlanService } = require("../services/alunoPlanService");
const { WorkoutPlanService } = require("../services/workoutPlanService");
const { CustomExerciseService } = require("../services/customExerciseService");
const { WorkoutSessionService } = require("../services/workoutSessionService");
const { TenantService } = require("../services/tenantService");
const { AgendaService } = require("../services/agendaService");
const { DietService } = require("../services/dietService");
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
const {
  WorkoutSessionController,
} = require("../controllers/workoutSessionController");
const {
  CustomExerciseController,
} = require("../controllers/customExerciseController");
const { TenantController } = require("../controllers/tenantController");
const { AgendaController } = require("../controllers/agendaController");
const { DietController } = require("../controllers/dietController");
const { MessageController } = require("../controllers/messageController");
const { MessageRepository } = require("../repositories/messageRepository");
const { MessageService } = require("../services/messageService");
const {
  PhysicalAssessmentRepository,
} = require("../repositories/physicalAssessmentRepository");
const {
  PhysicalAssessmentService,
} = require("../services/physicalAssessmentService");
const {
  PhysicalAssessmentController,
} = require("../controllers/physicalAssessmentController");

function buildContainer() {
  const userRepository = new UserRepository(prisma);
  const alunoRepository = new AlunoRepository(prisma);
  const personalRepository = new PersonalRepository(prisma);
  const subscriptionPlanRepository = new SubscriptionPlanRepository(prisma);
  const tenantSubscriptionRepository = new TenantSubscriptionRepository(prisma);
  const alunoPlanRepository = new AlunoPlanRepository(prisma);
  const workoutPlanRepository = new WorkoutPlanRepository(prisma);
  const customExerciseRepository = new CustomExerciseRepository(prisma);
  const workoutSessionRepository = new WorkoutSessionRepository(prisma);
  const agendaRepository = new AgendaRepository(prisma);
  const dietRepository = new DietRepository(prisma);
  const messageRepository = new MessageRepository(prisma);
  const physicalAssessmentRepository = new PhysicalAssessmentRepository(prisma);

  const authService = new AuthService(userRepository, personalRepository);
  const alunoService = new AlunoService(alunoRepository, agendaRepository);
  const superAdminService = new SuperAdminService(personalRepository);
  const subscriptionService = new SubscriptionService(
    subscriptionPlanRepository,
    tenantSubscriptionRepository,
  );
  const alunoPlanService = new AlunoPlanService(
    alunoPlanRepository,
    alunoRepository,
    personalRepository,
  );
  const workoutPlanService = new WorkoutPlanService(
    workoutPlanRepository,
    alunoRepository,
    agendaRepository,
  );
  const customExerciseService = new CustomExerciseService(
    customExerciseRepository,
  );
  const workoutSessionService = new WorkoutSessionService(
    workoutSessionRepository,
    workoutPlanRepository,
    alunoRepository,
  );
  const tenantService = new TenantService(personalRepository);
  const agendaService = new AgendaService(
    agendaRepository,
    alunoRepository,
    workoutPlanRepository,
  );
  const dietService = new DietService(dietRepository, alunoRepository);
  const messageService = new MessageService(messageRepository, alunoRepository);
  const physicalAssessmentService = new PhysicalAssessmentService(
    physicalAssessmentRepository,
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
  const customExerciseController = new CustomExerciseController(
    customExerciseService,
  );
  const workoutSessionController = new WorkoutSessionController(
    workoutSessionService,
  );
  const tenantController = new TenantController(tenantService);
  const agendaController = new AgendaController(agendaService);
  const dietController = new DietController(dietService);
  const messageController = new MessageController(messageService);
  const physicalAssessmentController = new PhysicalAssessmentController(
    physicalAssessmentService,
  );

  return {
    authController,
    alunoController,
    superAdminController,
    subscriptionController,
    alunoPlanController,
    workoutPlanController,
    customExerciseController,
    workoutSessionController,
    tenantController,
    agendaController,
    dietController,
    messageController,
    physicalAssessmentController,
  };
}

module.exports = { buildContainer };
