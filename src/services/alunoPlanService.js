const { AppError } = require("../utils/appError");

class AlunoPlanService {
  constructor(alunoPlanRepository, alunoRepository) {
    this.alunoPlanRepository = alunoPlanRepository;
    this.alunoRepository = alunoRepository;
  }

  listPlans(authContext) {
    if (!authContext?.personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    return this.alunoPlanRepository.listAll();
  }

  listPublicPlans(personalId) {
    if (!personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    return this.alunoPlanRepository.listPublicByPersonalId(personalId);
  }

  async createPlan(authContext, payload) {
    if (!authContext?.personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    if (!payload?.name || !payload?.monthlyPriceCents) {
      throw new AppError("name and monthlyPriceCents are required", 400);
    }

    return this.alunoPlanRepository.create({
      personalId: authContext.personalId,
      name: payload.name,
      description: payload.description || null,
      monthlyPriceCents: Number(payload.monthlyPriceCents),
      isActive: payload.isActive !== false,
    });
  }

  async updatePlan(authContext, id, payload) {
    if (!authContext?.personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    const found = await this.alunoPlanRepository.findById(id);

    if (!found) {
      throw new AppError("Aluno plan not found", 404);
    }

    return this.alunoPlanRepository.updateById(id, {
      name: payload.name ?? found.name,
      description: payload.description ?? found.description,
      monthlyPriceCents:
        payload.monthlyPriceCents !== undefined
          ? Number(payload.monthlyPriceCents)
          : found.monthlyPriceCents,
      isActive:
        payload.isActive !== undefined
          ? Boolean(payload.isActive)
          : found.isActive,
    });
  }

  async assignPlanToAluno(authContext, alunoId, alunoPlanId) {
    if (!authContext?.personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    const aluno = await this.alunoRepository.findById(alunoId);

    if (!aluno) {
      throw new AppError("Aluno not found", 404);
    }

    if (alunoPlanId) {
      const plan = await this.alunoPlanRepository.findById(alunoPlanId);

      if (!plan || !plan.isActive) {
        throw new AppError("Aluno plan not found or inactive", 404);
      }
    }

    return this.alunoRepository.assignPlan(alunoId, alunoPlanId || null);
  }

  async assignPlanToMyProfile(authContext, alunoPlanId) {
    if (!authContext?.userId || !authContext?.personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    const aluno = await this.alunoRepository.findByUserId(authContext.userId);

    if (!aluno) {
      throw new AppError("Aluno not found", 404);
    }

    const plan = await this.alunoPlanRepository.findById(alunoPlanId);

    if (!plan || !plan.isActive || plan.personalId !== authContext.personalId) {
      throw new AppError("Aluno plan not found", 404);
    }

    return this.alunoRepository.assignPlan(aluno.id, plan.id);
  }
}

module.exports = { AlunoPlanService };
