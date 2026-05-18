const { randomUUID } = require("node:crypto");

class PhysicalAssessmentService {
  constructor(physicalAssessmentRepository, alunoRepository) {
    this.repo = physicalAssessmentRepository;
    this.alunoRepository = alunoRepository;
  }

  // Ensure ALUNO only sees their own data
  async listByAluno(auth, alunoId) {
    if (auth?.role === "ALUNO") {
      // find aluno linked to this user
      const aluno = await this.alunoRepository.findByUserId(auth.userId);
      if (!aluno) throw new Error("Aluno not found");
      if (String(aluno.id) !== String(alunoId)) {
        const err = new Error("Forbidden");
        err.status = 403;
        throw err;
      }
    }

    return this.repo.listByAluno(alunoId);
  }

  async create(auth, payload) {
    const alunoId = payload.alunoId;

    if (auth?.role === "ALUNO") {
      // force alunoId to the authenticated aluno
      const aluno = await this.alunoRepository.findByUserId(auth.userId);
      if (!aluno) {
        const err = new Error("Aluno not found");
        err.status = 404;
        throw err;
      }
      if (alunoId && String(alunoId) !== String(aluno.id)) {
        const err = new Error("Forbidden");
        err.status = 403;
        throw err;
      }
      payload.alunoId = aluno.id;
    }

    const data = {
      id: payload.id || randomUUID(),
      personalId: auth.personalId,
      alunoId: payload.alunoId,
      date: payload.date || null,
      weight: payload.weight || null,
      height: payload.height || null,
      fatPercentage: payload.fatPercentage || payload.fat || null,
      age: payload.age || null,
      notes: payload.notes || null,
      photos: Array.isArray(payload.photos) ? payload.photos : null,
    };

    return this.repo.create(data);
  }

  async delete(auth, id) {
    return this.repo.deleteById(id);
  }
}

module.exports = { PhysicalAssessmentService };
