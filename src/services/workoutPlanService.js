const { AppError } = require("../utils/appError");

class WorkoutPlanService {
  constructor(workoutPlanRepository, alunoRepository) {
    this.workoutPlanRepository = workoutPlanRepository;
    this.alunoRepository = alunoRepository;
  }

  async listByAluno(authContext, alunoId) {
    if (!authContext?.personalId) {
      throw new AppError("Tenant context is required", 403);
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

  async getById(authContext, id) {
    if (!authContext?.personalId) {
      throw new AppError("Tenant context is required", 403);
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
}

module.exports = { WorkoutPlanService };
