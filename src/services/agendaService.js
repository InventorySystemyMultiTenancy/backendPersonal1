const { AppError } = require("../utils/appError");
const { isUuid } = require("../utils/validation");
const { randomUUID } = require("node:crypto");

const STUDENT_CHANGE_DEADLINE_HOURS = 2;

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

function startOfWeekMonday(date) {
  const current = new Date(date);
  current.setHours(0, 0, 0, 0);
  const day = current.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  current.setDate(current.getDate() + diffToMonday);
  return current;
}

function endOfWeekMonday(date) {
  const start = startOfWeekMonday(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

class AgendaService {
  constructor(agendaRepository, alunoRepository, workoutPlanRepository) {
    this.agendaRepository = agendaRepository;
    this.alunoRepository = alunoRepository;
    this.workoutPlanRepository = workoutPlanRepository;
  }

  async ensureNoWorkoutConflict({
    type,
    startsAt,
    endsAt,
    excludeEventId = null,
  }) {
    if (type !== "TREINO") {
      return;
    }

    const conflict = await this.agendaRepository.findWorkoutConflict({
      startsAt,
      endsAt,
      excludeEventId,
    });

    if (conflict) {
      throw new AppError(
        `Conflito de agenda: ja existe treino para ${conflict.aluno?.fullName || "outro aluno"} em ${conflict.startsAt.toISOString()}`,
        409,
      );
    }
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
      await this.ensureNoWorkoutConflict({
        type: baseEvent.type,
        startsAt,
        endsAt,
      });
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

      const occurrenceEnd =
        durationMs !== null
          ? new Date(occurrenceStart.getTime() + durationMs)
          : null;

      await this.ensureNoWorkoutConflict({
        type: baseEvent.type,
        startsAt: occurrenceStart,
        endsAt: occurrenceEnd,
      });

      events.push({
        ...baseEvent,
        startsAt: occurrenceStart,
        endsAt: occurrenceEnd,
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

    const nextData = {
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
    };

    await this.ensureNoWorkoutConflict({
      type: nextData.type,
      startsAt: nextData.startsAt,
      endsAt: nextData.endsAt,
      excludeEventId: id,
    });

    return this.agendaRepository.updateById(id, nextData);
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

  validateAlunoChangeWindow(eventStartsAt) {
    const startsAt = new Date(eventStartsAt);
    const now = new Date();
    const diffMs = startsAt.getTime() - now.getTime();
    const minimumMs = STUDENT_CHANGE_DEADLINE_HOURS * 60 * 60 * 1000;

    if (diffMs < minimumMs) {
      throw new AppError(
        `Cancelamento/remarcacao deve ser solicitado com no minimo ${STUDENT_CHANGE_DEADLINE_HOURS}h de antecedencia`,
        400,
      );
    }
  }

  async requestCancel(authContext, id, reason) {
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

    this.validateAlunoChangeWindow(current.startsAt);

    if (current.changeRequestStatus === "PENDING") {
      throw new AppError(
        "Ja existe uma solicitacao pendente para este horario",
        409,
      );
    }

    return this.agendaRepository.updateById(id, {
      changeRequestType: "CANCEL",
      changeRequestStatus: "PENDING",
      changeRequestReason: reason ? String(reason).trim() : null,
      changeRequestedAt: new Date(),
      proposedStartsAt: null,
      proposedEndsAt: null,
      reviewedAt: null,
    });
  }

  validateSameWeekReschedule(originalStartsAt, proposedStartsAt) {
    const weekStart = startOfWeekMonday(originalStartsAt);
    const weekEnd = endOfWeekMonday(originalStartsAt);
    if (proposedStartsAt < weekStart || proposedStartsAt > weekEnd) {
      throw new AppError(
        "Remarcacao permitida somente na mesma semana do horario original",
        400,
      );
    }
  }

  async requestReschedule(authContext, id, payload) {
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

    this.validateAlunoChangeWindow(current.startsAt);

    if (current.changeRequestStatus === "PENDING") {
      throw new AppError(
        "Ja existe uma solicitacao pendente para este horario",
        409,
      );
    }

    const proposedStartsAt = new Date(payload?.proposedStartsAt);
    if (Number.isNaN(proposedStartsAt.getTime())) {
      throw new AppError("proposedStartsAt must be a valid date", 400);
    }

    const proposedEndsAt = payload?.proposedEndsAt
      ? new Date(payload.proposedEndsAt)
      : current.endsAt
        ? new Date(
            proposedStartsAt.getTime() +
              (new Date(current.endsAt).getTime() -
                new Date(current.startsAt).getTime()),
          )
        : null;

    if (proposedEndsAt && Number.isNaN(proposedEndsAt.getTime())) {
      throw new AppError("proposedEndsAt must be a valid date", 400);
    }

    if (proposedEndsAt && proposedEndsAt <= proposedStartsAt) {
      throw new AppError("proposedEndsAt must be after proposedStartsAt", 400);
    }

    if (proposedStartsAt <= new Date()) {
      throw new AppError("Novo horario deve ser no futuro", 400);
    }

    this.validateSameWeekReschedule(current.startsAt, proposedStartsAt);

    await this.ensureNoWorkoutConflict({
      type: current.type,
      startsAt: proposedStartsAt,
      endsAt: proposedEndsAt,
      excludeEventId: id,
    });

    return this.agendaRepository.updateById(id, {
      changeRequestType: "RESCHEDULE",
      changeRequestStatus: "PENDING",
      changeRequestReason: payload?.reason
        ? String(payload.reason).trim()
        : null,
      changeRequestedAt: new Date(),
      proposedStartsAt,
      proposedEndsAt,
      reviewedAt: null,
    });
  }

  async reviewChangeRequest(authContext, id, payload) {
    if (!authContext?.personalId || authContext.role !== "PERSONAL") {
      throw new AppError("Tenant context is required", 403);
    }

    if (!isUuid(id)) {
      throw new AppError("id must be a valid UUID", 400);
    }

    const decision = String(payload?.decision || "").toUpperCase();
    if (!["APPROVE", "REJECT"].includes(decision)) {
      throw new AppError("decision must be APPROVE or REJECT", 400);
    }

    const current = await this.agendaRepository.findById(id);
    if (!current) {
      throw new AppError("Agenda event not found", 404);
    }

    if (current.personalId !== authContext.personalId) {
      throw new AppError("Agenda event not found", 404);
    }

    if (current.changeRequestStatus !== "PENDING") {
      throw new AppError("Este evento nao possui solicitacao pendente", 400);
    }

    if (decision === "REJECT") {
      const event = await this.agendaRepository.updateById(id, {
        changeRequestStatus: "REJECTED",
        reviewedAt: new Date(),
      });
      return { event };
    }

    if (current.changeRequestType === "CANCEL") {
      await this.agendaRepository.deleteById(id);
      return { deleted: true, id };
    }

    if (current.changeRequestType === "RESCHEDULE") {
      if (!current.proposedStartsAt) {
        throw new AppError("Solicitacao sem horario proposto", 400);
      }

      this.validateSameWeekReschedule(
        current.startsAt,
        current.proposedStartsAt,
      );
      await this.ensureNoWorkoutConflict({
        type: current.type,
        startsAt: current.proposedStartsAt,
        endsAt: current.proposedEndsAt,
        excludeEventId: id,
      });

      const event = await this.agendaRepository.updateById(id, {
        startsAt: current.proposedStartsAt,
        endsAt: current.proposedEndsAt,
        changeRequestType: "NONE",
        changeRequestStatus: "APPROVED",
        reviewedAt: new Date(),
      });

      return { event };
    }

    throw new AppError("Tipo de solicitacao invalido", 400);
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
