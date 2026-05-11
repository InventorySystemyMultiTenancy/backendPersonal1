const { AppError } = require("../utils/appError");
const { isUuid } = require("../utils/validation");

class WorkoutSessionService {
  constructor(
    workoutSessionRepository,
    workoutPlanRepository,
    alunoRepository,
  ) {
    this.workoutSessionRepository = workoutSessionRepository;
    this.workoutPlanRepository = workoutPlanRepository;
    this.alunoRepository = alunoRepository;
  }

  async listForPersonal(authContext, query) {
    if (!authContext?.personalId || authContext.role !== "PERSONAL") {
      throw new AppError("Tenant context is required", 403);
    }

    const alunoId = query?.alunoId ? String(query.alunoId).trim() : null;
    if (alunoId && !isUuid(alunoId)) {
      throw new AppError("alunoId must be a valid UUID", 400);
    }

    const from = query?.from ? new Date(query.from) : null;
    const to = query?.to ? new Date(query.to) : null;

    return this.workoutSessionRepository.listForPersonal({
      personalId: authContext.personalId,
      alunoId,
      from,
      to,
    });
  }

  async listForAluno(authContext, query) {
    if (!authContext?.userId || authContext.role !== "ALUNO") {
      throw new AppError("Unauthorized", 401);
    }

    const aluno = await this.alunoRepository.findByUserId(authContext.userId);
    if (!aluno) {
      throw new AppError("Aluno not found", 404);
    }

    const from = query?.from ? new Date(query.from) : null;
    const to = query?.to ? new Date(query.to) : null;

    return this.workoutSessionRepository.listForAluno(aluno.id, { from, to });
  }

  async start(authContext, payload) {
    if (!authContext?.userId || authContext.role !== "ALUNO") {
      throw new AppError("Unauthorized", 401);
    }

    if (!payload?.workoutPlanId || !isUuid(payload.workoutPlanId)) {
      throw new AppError("workoutPlanId must be a valid UUID", 400);
    }

    const aluno = await this.alunoRepository.findByUserId(authContext.userId);
    if (!aluno) {
      throw new AppError("Aluno not found", 404);
    }

    const workoutPlan = await this.workoutPlanRepository.findById(
      payload.workoutPlanId,
    );

    if (!workoutPlan || workoutPlan.alunoId !== aluno.id) {
      throw new AppError("Workout plan not found", 404);
    }

    return this.workoutSessionRepository.createStartedSession({
      personalId: aluno.personalId,
      alunoId: aluno.id,
      workoutPlanId: workoutPlan.id,
      startedAt: payload?.startedAt ? new Date(payload.startedAt) : new Date(),
    });
  }

  async finish(authContext, payload) {
    if (!authContext?.userId || authContext.role !== "ALUNO") {
      throw new AppError("Unauthorized", 401);
    }

    const aluno = await this.alunoRepository.findByUserId(authContext.userId);
    if (!aluno) {
      throw new AppError("Aluno not found", 404);
    }

    let session = null;

    if (payload?.sessionId) {
      if (!isUuid(payload.sessionId)) {
        throw new AppError("sessionId must be a valid UUID", 400);
      }
      session = await this.workoutSessionRepository.findById(payload.sessionId);
      if (!session || session.alunoId !== aluno.id) {
        throw new AppError("Workout session not found", 404);
      }
    } else {
      if (!payload?.workoutPlanId || !isUuid(payload.workoutPlanId)) {
        throw new AppError(
          "workoutPlanId must be a valid UUID when sessionId is not provided",
          400,
        );
      }

      const workoutPlan = await this.workoutPlanRepository.findById(
        payload.workoutPlanId,
      );
      if (!workoutPlan || workoutPlan.alunoId !== aluno.id) {
        throw new AppError("Workout plan not found", 404);
      }

      session = await this.workoutSessionRepository.createStartedSession({
        personalId: aluno.personalId,
        alunoId: aluno.id,
        workoutPlanId: workoutPlan.id,
        startedAt: payload?.startedAt
          ? new Date(payload.startedAt)
          : new Date(Date.now() - 60 * 1000),
      });
    }

    const finishedAt = payload?.finishedAt
      ? new Date(payload.finishedAt)
      : new Date();
    if (Number.isNaN(finishedAt.getTime())) {
      throw new AppError("finishedAt must be a valid date", 400);
    }

    const startedAt = new Date(session.startedAt);
    const durationSeconds = Math.max(
      0,
      Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000),
    );

    const items = Array.isArray(payload?.items)
      ? payload.items
          .filter((item) => item && item.exerciseName)
          .map((item, index) => ({
            exerciseName: String(item.exerciseName),
            loadNotes: item.loadNotes ? String(item.loadNotes) : null,
            orderIndex: Number(item.orderIndex ?? index),
          }))
      : [];

    return this.workoutSessionRepository.finishSession(session.id, {
      finishedAt,
      durationSeconds,
      items,
    });
  }
}

module.exports = { WorkoutSessionService };
