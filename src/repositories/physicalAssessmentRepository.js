class PhysicalAssessmentRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async listByAluno(alunoId) {
    return this.prisma.physicalAssessment.findMany({
      where: { alunoId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
  }

  async create(data) {
    return this.prisma.physicalAssessment.create({ data });
  }

  async deleteById(id) {
    return this.prisma.physicalAssessment.delete({ where: { id } });
  }
}

module.exports = { PhysicalAssessmentRepository };
