const { AppError } = require("../utils/appError");
const { isUuid } = require("../utils/validation");

const ALLOWED_WEEKDAYS = new Set([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]);

function normalizeDays(days) {
  if (!Array.isArray(days) || days.length === 0) {
    throw new AppError("At least one weekday is required", 400);
  }

  const dedupe = new Map();

  days.forEach((day) => {
    const weekday = String(day?.weekday || "").toUpperCase();
    const mealPlan = String(day?.mealPlan || "").trim();

    if (!ALLOWED_WEEKDAYS.has(weekday)) {
      throw new AppError("weekday is invalid", 400);
    }

    if (!mealPlan) {
      throw new AppError("mealPlan is required for each selected weekday", 400);
    }

    dedupe.set(weekday, { weekday, mealPlan });
  });

  return Array.from(dedupe.values());
}

class DietService {
  constructor(dietRepository, alunoRepository) {
    this.dietRepository = dietRepository;
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

    return this.dietRepository.listForPersonal({ alunoId });
  }

  async listForAluno(authContext) {
    if (!authContext?.userId || authContext.role !== "ALUNO") {
      throw new AppError("Unauthorized", 401);
    }

    const aluno = await this.alunoRepository.findByUserId(authContext.userId);

    if (!aluno) {
      throw new AppError("Aluno not found", 404);
    }

    return this.dietRepository.listForAluno(aluno.id);
  }

  async create(authContext, payload) {
    if (!authContext?.personalId || authContext.role !== "PERSONAL") {
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

    const days = normalizeDays(payload.days);

    return this.dietRepository.createWithDays({
      alunoId: payload.alunoId,
      title: String(payload.title).trim(),
      description: payload.description
        ? String(payload.description).trim()
        : null,
      days,
    });
  }

  async update(authContext, id, payload) {
    if (!authContext?.personalId || authContext.role !== "PERSONAL") {
      throw new AppError("Tenant context is required", 403);
    }

    if (!isUuid(id)) {
      throw new AppError("id must be a valid UUID", 400);
    }

    const current = await this.dietRepository.findById(id);

    if (!current) {
      throw new AppError("Diet plan not found", 404);
    }

    const alunoId = payload.alunoId ?? current.alunoId;
    if (!isUuid(alunoId)) {
      throw new AppError("alunoId must be a valid UUID", 400);
    }

    const aluno = await this.alunoRepository.findById(alunoId);
    if (!aluno) {
      throw new AppError("Aluno not found", 404);
    }

    const days =
      payload.days !== undefined
        ? normalizeDays(payload.days)
        : current.days.map((day) => ({
            weekday: day.weekday,
            mealPlan: day.mealPlan,
          }));

    return this.dietRepository.updateWithDays(id, {
      alunoId,
      title:
        payload.title !== undefined
          ? String(payload.title).trim()
          : current.title,
      description:
        payload.description !== undefined
          ? payload.description
            ? String(payload.description).trim()
            : null
          : current.description,
      days,
    });
  }

  async remove(authContext, id) {
    if (!authContext?.personalId || authContext.role !== "PERSONAL") {
      throw new AppError("Tenant context is required", 403);
    }

    if (!isUuid(id)) {
      throw new AppError("id must be a valid UUID", 400);
    }

    const deleted = await this.dietRepository.deleteById(id);

    if (!deleted) {
      throw new AppError("Diet plan not found", 404);
    }

    return { deleted: true };
  }
}

module.exports = { DietService };
