const { AppError } = require("../utils/appError");
const { isUuid } = require("../utils/validation");

class AlunoService {
  constructor(alunoRepository) {
    this.alunoRepository = alunoRepository;
  }

  // Main multi-tenant example requested: scoped by authContext.personalId.
  async getAllAlunos(authContext) {
    if (!authContext || !authContext.personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    return this.alunoRepository.getAll(authContext);
  }

  async createAluno(authContext, payload) {
    if (!authContext || !authContext.personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    return this.alunoRepository.create(authContext, {
      fullName: payload.fullName,
      email: payload.email || null,
      phone: payload.phone || null,
      birthDate: payload.birthDate ? new Date(payload.birthDate) : null,
      planDueDate: payload.planDueDate ? new Date(payload.planDueDate) : null,
      alunoPlanId: payload.alunoPlanId || null,
      isActive: payload.isActive !== false,
    });
  }

  async updateAluno(authContext, id, payload) {
    if (!authContext || !authContext.personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    if (!isUuid(id)) {
      throw new AppError("id must be a valid UUID", 400);
    }

    if (payload?.alunoPlanId && !isUuid(payload.alunoPlanId)) {
      throw new AppError("alunoPlanId must be a valid UUID", 400);
    }

    const current = await this.alunoRepository.findById(id);

    if (!current) {
      throw new AppError("Aluno not found", 404);
    }

    return this.alunoRepository.updateById(id, {
      fullName: payload.fullName ?? current.fullName,
      email: payload.email ?? current.email,
      phone: payload.phone ?? current.phone,
      birthDate:
        payload.birthDate !== undefined
          ? payload.birthDate
            ? new Date(payload.birthDate)
            : null
          : current.birthDate,
      planDueDate:
        payload.planDueDate !== undefined
          ? payload.planDueDate
            ? new Date(payload.planDueDate)
            : null
          : current.planDueDate,
      alunoPlanId:
        payload.alunoPlanId !== undefined
          ? payload.alunoPlanId || null
          : current.alunoPlanId,
      isActive:
        payload.isActive !== undefined
          ? Boolean(payload.isActive)
          : current.isActive,
    });
  }

  async getMyProfile(authContext) {
    if (!authContext?.userId) {
      throw new AppError("Unauthorized", 401);
    }

    const aluno = await this.alunoRepository.findProfileByUserId(
      authContext.userId,
    );

    if (!aluno) {
      throw new AppError("Aluno not found", 404);
    }

    return aluno;
  }
}

module.exports = { AlunoService };
