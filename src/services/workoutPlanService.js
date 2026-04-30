const { AppError } = require("../utils/appError");
const { isUuid } = require("../utils/validation");

class WorkoutPlanService {
  constructor(workoutPlanRepository, alunoRepository, agendaRepository) {
    this.workoutPlanRepository = workoutPlanRepository;
    this.alunoRepository = alunoRepository;
    this.agendaRepository = agendaRepository;
  }

  addRecurrence(baseDate, recurrence, step) {
    const next = new Date(baseDate);
    if (recurrence === "WEEKLY") {
      next.setDate(next.getDate() + 7 * step);
      return next;
    }
    if (recurrence === "MONTHLY") {
      next.setMonth(next.getMonth() + step);
      return next;
    }
    return next;
  }

  async listByAluno(authContext, alunoId) {
    if (!authContext?.personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    if (!isUuid(alunoId)) {
      throw new AppError("alunoId must be a valid UUID", 400);
    }

    const aluno = await this.alunoRepository.findById(alunoId);

    if (!aluno) {
      throw new AppError("Aluno not found", 404);
    }

    return this.workoutPlanRepository.listByAluno(alunoId);
  }

  async create(authContext, payload) {
    if (!authContext?.personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    if (!payload?.alunoId || !payload?.title) {
      throw new AppError("alunoId and title are required", 400);
    }

    if (!isUuid(payload.alunoId)) {
      throw new AppError("alunoId must be a valid UUID", 400);
    }

    const aluno = await this.alunoRepository.findById(payload.alunoId);

    if (!aluno) {
      throw new AppError("Aluno not found", 404);
    }

    return this.workoutPlanRepository.createWithItems({
      alunoId: payload.alunoId,
      title: payload.title,
      objective: payload.objective || null,
      isActive: payload.isActive !== false,
      items: Array.isArray(payload.items) ? payload.items : [],
    });
  }

  async listMine(authContext) {
    if (!authContext?.userId || authContext.role !== "ALUNO") {
      throw new AppError("Unauthorized", 401);
    }

    const aluno = await this.alunoRepository.findByUserId(authContext.userId);
    if (!aluno) {
      throw new AppError("Aluno not found", 404);
    }

    const plans = await this.workoutPlanRepository.listByAluno(aluno.id);
    const now = new Date();

    const plansWithSchedule = await Promise.all(
      plans.map(async (plan) => {
        const upcomingEvents = await this.agendaRepository.listByWorkoutPlan(plan.id, {
          from: now,
        });

        return {
          ...plan,
          schedule: upcomingEvents,
        };
      }),
    );

    return plansWithSchedule;
  }

  async getById(authContext, id) {
    if (!authContext?.personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    if (!isUuid(id)) {
      throw new AppError("id must be a valid UUID", 400);
    }

    const found = await this.workoutPlanRepository.findById(id);

    if (!found) {
      throw new AppError("Workout plan not found", 404);
    }

    return found;
  }

  async update(authContext, id, payload) {
    if (!authContext?.personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    if (!isUuid(id)) {
      throw new AppError("id must be a valid UUID", 400);
    }

    const existing = await this.workoutPlanRepository.findById(id);

    if (!existing) {
      throw new AppError("Workout plan not found", 404);
    }

    return this.workoutPlanRepository.updateWithItems(id, {
      title: payload.title ?? existing.title,
      objective: payload.objective ?? existing.objective,
      isActive:
        payload.isActive !== undefined
          ? Boolean(payload.isActive)
          : existing.isActive,
      items: payload.items,
    });
  }

  async schedulePlan(authContext, workoutPlanId, payload) {
    if (!authContext?.personalId || authContext.role !== "PERSONAL") {
      throw new AppError("Tenant context is required", 403);
    }

    if (!isUuid(workoutPlanId)) {
      throw new AppError("workoutPlanId must be a valid UUID", 400);
    }

    const plan = await this.workoutPlanRepository.findById(workoutPlanId);
    if (!plan) {
      throw new AppError("Workout plan not found", 404);
    }

    const sessions = Array.isArray(payload?.sessions) ? payload.sessions : [];
    if (!sessions.length) {
      throw new AppError("sessions is required and must be a non-empty array", 400);
    }

    if (payload?.replaceExisting === true) {
      await this.agendaRepository.deleteByWorkoutPlanId(workoutPlanId, {
        from: new Date(),
      });
    }

    const eventsToCreate = [];

    for (const session of sessions) {
      if (!session?.startsAt) {
        throw new AppError("Each session must have startsAt", 400);
      }

      const startsAt = new Date(session.startsAt);
      const endsAt = session.endsAt ? new Date(session.endsAt) : null;
      const recurrence = session.recurrence || "NONE";
      const recurrenceUntil = session.recurrenceUntil
        ? new Date(session.recurrenceUntil)
        : null;

      if (Number.isNaN(startsAt.getTime())) {
        throw new AppError("session.startsAt must be a valid date", 400);
      }

      if (endsAt && Number.isNaN(endsAt.getTime())) {
        throw new AppError("session.endsAt must be a valid date", 400);
      }

      if (!["NONE", "WEEKLY", "MONTHLY"].includes(recurrence)) {
        throw new AppError("session.recurrence must be NONE, WEEKLY or MONTHLY", 400);
      }

      const baseEvent = {
        alunoId: plan.alunoId,
        workoutPlanId: plan.id,
        type: "TREINO",
        recurrence,
        recurrenceUntil,
        recurrenceGroupId: recurrence === "NONE" ? null : (session.recurrenceGroupId || null),
        attendanceStatus: "PENDENTE",
        title: session.title || plan.title,
        description: session.description || plan.objective || null,
        dietNotes: null,
        startsAt,
        endsAt,
        isDone: false,
      };

      if (recurrence === "NONE") {
        eventsToCreate.push(baseEvent);
        continue;
      }

      if (!recurrenceUntil || Number.isNaN(recurrenceUntil.getTime())) {
        throw new AppError("session.recurrenceUntil is required for recurring sessions", 400);
      }

      if (recurrenceUntil < startsAt) {
        throw new AppError("session.recurrenceUntil must be after session.startsAt", 400);
      }

      const maxOccurrences = 104;
      const durationMs = endsAt ? endsAt.getTime() - startsAt.getTime() : null;

      for (let i = 0; i < maxOccurrences; i += 1) {
        const occurrenceStart = this.addRecurrence(startsAt, recurrence, i);
        if (occurrenceStart > recurrenceUntil) {
          break;
        }

        eventsToCreate.push({
          ...baseEvent,
          startsAt: occurrenceStart,
          endsAt:
            durationMs !== null
              ? new Date(occurrenceStart.getTime() + durationMs)
              : null,
        });
      }
    }

    if (!eventsToCreate.length) {
      throw new AppError("No schedule events generated", 400);
    }

    const createdEvents = await this.agendaRepository.createMany(eventsToCreate);

    return {
      workoutPlanId: plan.id,
      alunoId: plan.alunoId,
      createdCount: createdEvents.length,
      events: createdEvents,
    };
  }
}

module.exports = { WorkoutPlanService };
