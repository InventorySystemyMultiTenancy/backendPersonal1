const { AppError } = require("../utils/appError");
const { isUuid } = require("../utils/validation");
const { randomUUID } = require("node:crypto");

function addRecurrence(baseDate, recurrence, step) {
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

class AgendaService {
  constructor(agendaRepository, alunoRepository, workoutPlanRepository) {
    this.agendaRepository = agendaRepository;
    this.alunoRepository = alunoRepository;
    this.workoutPlanRepository = workoutPlanRepository;
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

    return this.agendaRepository.listForPersonal({ alunoId, from, to });
  }

  async listForAluno(authContext) {
    if (!authContext?.userId || authContext.role !== "ALUNO") {
      throw new AppError("Unauthorized", 401);
    }

    const aluno = await this.alunoRepository.findByUserId(authContext.userId);

    if (!aluno) {
      throw new AppError("Aluno not found", 404);
    }

    return this.agendaRepository.listForAluno(aluno.id);
  }

  async create(authContext, payload) {
    if (!authContext?.personalId || authContext.role !== "PERSONAL") {
      throw new AppError("Tenant context is required", 403);
    }

    if (!payload?.alunoId || !payload?.title || !payload?.startsAt) {
      throw new AppError("alunoId, title and startsAt are required", 400);
    }

    if (!isUuid(payload.alunoId)) {
      throw new AppError("alunoId must be a valid UUID", 400);
    }

    if (payload.workoutPlanId && !isUuid(payload.workoutPlanId)) {
      throw new AppError("workoutPlanId must be a valid UUID", 400);
    }

    if (
      payload.recurrence &&
      !["NONE", "WEEKLY", "MONTHLY"].includes(payload.recurrence)
    ) {
      throw new AppError("recurrence must be NONE, WEEKLY or MONTHLY", 400);
    }

    const aluno = await this.alunoRepository.findById(payload.alunoId);

    if (!aluno) {
      throw new AppError("Aluno not found", 404);
    }

    if (payload.workoutPlanId) {
      const workout = await this.workoutPlanRepository.findById(
        payload.workoutPlanId,
      );
      if (!workout) {
        throw new AppError("Workout plan not found", 404);
      }
    }

    const startsAt = new Date(payload.startsAt);
    const endsAt = payload.endsAt ? new Date(payload.endsAt) : null;
    const recurrence = payload.recurrence || "NONE";
    const recurrenceUntil = payload.recurrenceUntil
      ? new Date(payload.recurrenceUntil)
      : null;
    const recurrenceGroupId =
      recurrence !== "NONE" ? randomUUID() : payload.recurrenceGroupId || null;

    if (Number.isNaN(startsAt.getTime())) {
      throw new AppError("startsAt must be a valid date", 400);
    }

    if (endsAt && Number.isNaN(endsAt.getTime())) {
      throw new AppError("endsAt must be a valid date", 400);
    }

    if (recurrence !== "NONE") {
      if (!recurrenceUntil || Number.isNaN(recurrenceUntil.getTime())) {
        throw new AppError(
          "recurrenceUntil is required for recurring events",
          400,
        );
      }

      if (recurrenceUntil < startsAt) {
        throw new AppError("recurrenceUntil must be after startsAt", 400);
      }
    }

    const baseEvent = {
      alunoId: payload.alunoId,
      workoutPlanId: payload.workoutPlanId || null,
      type: payload.type || "OUTRO",
      recurrence,
      recurrenceUntil,
      recurrenceGroupId,
      attendanceStatus: payload.attendanceStatus || "PENDENTE",
      title: payload.title,
      description: payload.description || null,
      dietNotes: payload.dietNotes || null,
      startsAt,
      endsAt,
      isDone: payload.isDone === true,
    };

    if (recurrence === "NONE") {
      return this.agendaRepository.create(baseEvent);
    }

    const events = [];
    const maxOccurrences = 104;
    const durationMs = endsAt ? endsAt.getTime() - startsAt.getTime() : null;

    for (let i = 0; i < maxOccurrences; i += 1) {
      const occurrenceStart = addRecurrence(startsAt, recurrence, i);
      if (occurrenceStart > recurrenceUntil) {
        break;
      }

      events.push({
        ...baseEvent,
        startsAt: occurrenceStart,
        endsAt:
          durationMs !== null
            ? new Date(occurrenceStart.getTime() + durationMs)
            : null,
      });
    }

    if (events.length === 0) {
      throw new AppError("No recurrence instances generated", 400);
    }

    const created = await this.agendaRepository.createMany(events);
    return created[0];
  }

  async update(authContext, id, payload) {
    if (!authContext?.personalId || authContext.role !== "PERSONAL") {
      throw new AppError("Tenant context is required", 403);
    }

    if (!isUuid(id)) {
      throw new AppError("id must be a valid UUID", 400);
    }

    const current = await this.agendaRepository.findById(id);

    if (!current) {
      throw new AppError("Agenda event not found", 404);
    }

    if (payload.alunoId && !isUuid(payload.alunoId)) {
      throw new AppError("alunoId must be a valid UUID", 400);
    }

    if (payload.workoutPlanId && !isUuid(payload.workoutPlanId)) {
      throw new AppError("workoutPlanId must be a valid UUID", 400);
    }

    if (payload.alunoId) {
      const aluno = await this.alunoRepository.findById(payload.alunoId);
      if (!aluno) {
        throw new AppError("Aluno not found", 404);
      }
    }

    if (payload.workoutPlanId) {
      const workout = await this.workoutPlanRepository.findById(
        payload.workoutPlanId,
      );
      if (!workout) {
        throw new AppError("Workout plan not found", 404);
      }
    }

    return this.agendaRepository.updateById(id, {
      alunoId:
        payload.alunoId !== undefined ? payload.alunoId : current.alunoId,
      workoutPlanId:
        payload.workoutPlanId !== undefined
          ? payload.workoutPlanId || null
          : current.workoutPlanId,
      type: payload.type ?? current.type,
      recurrence: payload.recurrence ?? current.recurrence,
      recurrenceUntil:
        payload.recurrenceUntil !== undefined
          ? payload.recurrenceUntil
            ? new Date(payload.recurrenceUntil)
            : null
          : current.recurrenceUntil,
      attendanceStatus:
        payload.attendanceStatus !== undefined
          ? payload.attendanceStatus
          : current.attendanceStatus,
      title: payload.title ?? current.title,
      description: payload.description ?? current.description,
      dietNotes: payload.dietNotes ?? current.dietNotes,
      startsAt:
        payload.startsAt !== undefined
          ? new Date(payload.startsAt)
          : current.startsAt,
      endsAt:
        payload.endsAt !== undefined
          ? payload.endsAt
            ? new Date(payload.endsAt)
            : null
          : current.endsAt,
      isDone:
        payload.isDone !== undefined ? Boolean(payload.isDone) : current.isDone,
    });
  }

  async confirmAttendance(authContext, id, attendanceStatus) {
    if (!authContext?.userId || authContext.role !== "ALUNO") {
      throw new AppError("Unauthorized", 401);
    }

    if (!isUuid(id)) {
      throw new AppError("id must be a valid UUID", 400);
    }

    const aluno = await this.alunoRepository.findByUserId(authContext.userId);

    if (!aluno) {
      throw new AppError("Aluno not found", 404);
    }

    const current = await this.agendaRepository.findById(id);

    if (!current || current.alunoId !== aluno.id) {
      throw new AppError("Agenda event not found", 404);
    }

    const nextStatus = attendanceStatus || "CONFIRMADO";
    if (!["PENDENTE", "CONFIRMADO"].includes(nextStatus)) {
      throw new AppError(
        "Aluno can set attendance to PENDENTE or CONFIRMADO only",
        400,
      );
    }

    return this.agendaRepository.updateById(id, {
      attendanceStatus: nextStatus,
    });
  }

  async remove(authContext, id) {
    if (!authContext?.personalId || authContext.role !== "PERSONAL") {
      throw new AppError("Tenant context is required", 403);
    }

    if (!isUuid(id)) {
      throw new AppError("id must be a valid UUID", 400);
    }

    const deleted = await this.agendaRepository.deleteById(id);

    if (!deleted) {
      throw new AppError("Agenda event not found", 404);
    }

    return { deleted: true };
  }
}

module.exports = { AgendaService };
