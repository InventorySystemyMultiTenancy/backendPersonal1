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

  async deleteById(id, personalId) {
    const result = await this.prisma.physicalAssessment.deleteMany({
      where: { id, personalId },
    });

    return result.count > 0;
  }
}

module.exports = { PhysicalAssessmentRepository };
