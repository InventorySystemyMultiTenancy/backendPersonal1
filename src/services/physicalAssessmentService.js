const { randomUUID } = require("node:crypto");
const {
  calculatePhysicalAssessment,
} = require("./calculators/physicalAssessmentCalculator");

function parseBrazilDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T15:00:00.000Z`);
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

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

    const dateValue = parseBrazilDate(payload.date);
    const calculated = this.maybeCalculate(payload);

    const data = {
      id: payload.id || randomUUID(),
      personalId: auth.personalId,
      alunoId: payload.alunoId,
      date: dateValue,
      sex: calculated?.sex || payload.sex || payload.gender || null,
      age: calculated?.age ?? payload.age ?? payload.idade ?? null,
      weight: calculated?.weightKg ?? payload.weightKg ?? payload.weight ?? null,
      height: calculated?.heightCm ?? payload.heightCm ?? payload.height ?? null,
      waistCm: calculated?.waistCm ?? payload.waistCm ?? payload.cintura ?? null,
      neckCm:
        calculated?.neckCm ??
        payload.neckCm ??
        payload.pescoco ??
        payload.pescoço ??
        null,
      hipCm: calculated?.hipCm ?? payload.hipCm ?? payload.quadril ?? null,
      bmi: calculated?.bmi ?? payload.bmi ?? null,
      bmiClassification:
        calculated?.bmiClassification ?? payload.bmiClassification ?? null,
      fatPercentage:
        calculated?.fatPercentage ?? payload.fatPercentage ?? payload.fat ?? null,
      leanMass: calculated?.leanMass ?? payload.leanMass ?? null,
      leanMassPercentage:
        calculated?.leanMassPercentage ?? payload.leanMassPercentage ?? null,
      fatWeight: calculated?.fatWeight ?? payload.fatWeight ?? null,
      basalMetabolicRate:
        calculated?.basalMetabolicRate ?? payload.basalMetabolicRate ?? null,
      calculationMethod:
        calculated?.calculationMethod ?? payload.calculationMethod ?? null,
      notes: payload.notes || null,
      photos: Array.isArray(payload.photos) ? payload.photos : null,
    };

    return this.repo.create(data);
  }

  calculate(payload) {
    return calculatePhysicalAssessment(payload || {});
  }

  maybeCalculate(payload) {
    if (payload?.calculate === false) {
      return null;
    }

    const hasSex = Boolean(payload?.sex || payload?.gender || payload?.sexo);
    const hasAge = payload?.age !== undefined || payload?.idade !== undefined;
    const hasWeight =
      payload?.weightKg !== undefined ||
      payload?.weight !== undefined ||
      payload?.peso !== undefined;
    const hasHeight =
      payload?.heightCm !== undefined ||
      payload?.height !== undefined ||
      payload?.altura !== undefined;
    const hasWaist = payload?.waistCm !== undefined || payload?.cintura !== undefined;
    const hasNeck =
      payload?.neckCm !== undefined ||
      payload?.pescoco !== undefined ||
      payload?.pescoço !== undefined;

    if (!hasSex || !hasAge || !hasWeight || !hasHeight || !hasWaist || !hasNeck) {
      return null;
    }

    return calculatePhysicalAssessment(payload);
  }

  async delete(auth, id) {
    if (auth?.role !== "PERSONAL" || !auth?.personalId) {
      const err = new Error("Forbidden");
      err.status = 403;
      throw err;
    }

    const removed = await this.repo.deleteById(id, auth.personalId);
    if (!removed) {
      const err = new Error("Assessment not found");
      err.status = 404;
      throw err;
    }

    return { deleted: true, id };
  }
}

module.exports = { PhysicalAssessmentService };
