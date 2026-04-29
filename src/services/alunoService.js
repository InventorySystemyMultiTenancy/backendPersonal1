const { AppError } = require("../utils/appError");

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
