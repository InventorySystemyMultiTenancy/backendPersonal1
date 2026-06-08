const { randomUUID } = require("node:crypto");

function parseBrazilDateTime(date, time) {
  if (!date || !time) return null;
  const rawDate = String(date);
  const rawTime = String(time);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return null;
  if (!/^\d{2}:\d{2}$/.test(rawTime)) return null;
  const parsed = new Date(`${rawDate}T${rawTime}:00-03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

class PersonalEventService {
  constructor(personalEventRepository, alunoRepository) {
    this.personalEventRepository = personalEventRepository;
    this.alunoRepository = alunoRepository;
  }

  async listForPersonal(authContext) {
    if (!authContext?.personalId) {
      const err = new Error("Tenant context is required");
      err.status = 403;
      throw err;
    }

    return this.personalEventRepository.listForPersonal();
  }

  async listForAluno(authContext) {
    if (!authContext?.userId) {
      const err = new Error("Unauthorized");
      err.status = 401;
      throw err;
    }

    const aluno = await this.alunoRepository.findByUserId(authContext.userId);
    if (!aluno) {
      const err = new Error("Aluno not found");
      err.status = 404;
      throw err;
    }

    return this.personalEventRepository.listForAluno(aluno.id);
  }

  async create(authContext, payload) {
    if (!authContext?.personalId) {
      const err = new Error("Tenant context is required");
      err.status = 403;
      throw err;
    }

    const startsAt = parseBrazilDateTime(payload.date, payload.time);
    if (!payload.title || !startsAt) {
      const err = new Error("Title, date and time are required");
      err.status = 400;
      throw err;
    }

    const alunoIds = Array.isArray(payload.alunoIds)
      ? [...new Set(payload.alunoIds.filter(Boolean).map(String))]
      : [];

    return this.personalEventRepository.createWithParticipants(
      authContext,
      {
        id: payload.id || randomUUID(),
        title: String(payload.title).trim(),
        description: payload.description || null,
        location: payload.location || null,
        startsAt,
      },
      alunoIds,
    );
  }

  async respond(authContext, eventId, status) {
    if (!["GOING", "NOT_GOING"].includes(status)) {
      const err = new Error("Invalid status");
      err.status = 400;
      throw err;
    }

    const aluno = await this.alunoRepository.findByUserId(authContext.userId);
    if (!aluno) {
      const err = new Error("Aluno not found");
      err.status = 404;
      throw err;
    }

    const participant = await this.personalEventRepository.findParticipant(
      eventId,
      aluno.id,
    );
    if (!participant) {
      const err = new Error("Event not found");
      err.status = 404;
      throw err;
    }

    await this.personalEventRepository.updateParticipantStatus({
      eventId,
      alunoId: aluno.id,
      status,
    });

    return this.personalEventRepository.findParticipant(eventId, aluno.id);
  }
}

module.exports = { PersonalEventService };
