const { AppError } = require("../utils/appError");
const { isUuid } = require("../utils/validation");

class AlunoPlanService {
  constructor(alunoPlanRepository, alunoRepository, personalRepository) {
    this.alunoPlanRepository = alunoPlanRepository;
    this.alunoRepository = alunoRepository;
    this.personalRepository = personalRepository;
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

    let resolvedPersonalId = String(personalId).trim();

    if (!isUuid(resolvedPersonalId)) {
      return this.personalRepository
        .findTenantByIdentifier(resolvedPersonalId)
        .then((tenant) => {
          if (!tenant) {
            throw new AppError("Tenant not found for provided personalId", 404);
          }

          if (tenant.ambiguous) {
            throw new AppError(
              "Ambiguous tenant identifier. Use tenant UUID (personalId).",
              400,
            );
          }

          return this.alunoPlanRepository.listPublicByPersonalId(tenant.id);
        });
    }

    return this.alunoPlanRepository.listPublicByPersonalId(resolvedPersonalId);
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

    if (!isUuid(id)) {
      throw new AppError("id must be a valid UUID", 400);
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

  async deletePlan(authContext, id) {
    if (!authContext?.personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    if (!isUuid(id)) {
      throw new AppError("id must be a valid UUID", 400);
    }

    const found = await this.alunoPlanRepository.findById(id);

    if (!found) {
      throw new AppError("Aluno plan not found", 404);
    }

    const deleted = await this.alunoPlanRepository.deleteById(id);
    if (!deleted) {
      throw new AppError("Aluno plan not found", 404);
    }

    return { deleted: true };
  }

  async assignPlanToAluno(authContext, alunoId, alunoPlanId) {
    if (!authContext?.personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    if (!isUuid(alunoId)) {
      throw new AppError("alunoId must be a valid UUID", 400);
    }

    if (alunoPlanId && !isUuid(alunoPlanId)) {
      throw new AppError("alunoPlanId must be a valid UUID", 400);
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

    if (!isUuid(alunoPlanId)) {
      throw new AppError("alunoPlanId must be a valid UUID", 400);
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
