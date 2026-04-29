class AlunoPlanRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  listAll() {
    return this.prisma.alunoPlan.findMany({
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    });
  }

  listPublicByPersonalId(personalId) {
    return this.prisma.alunoPlan.findMany({
      where: {
        personalId,
        isActive: true,
      },
      orderBy: [{ createdAt: "desc" }],
    });
  }

  findById(id) {
    return this.prisma.alunoPlan.findFirst({
      where: { id },
    });
  }

  create(data) {
    return this.prisma.alunoPlan.create({ data });
  }

  async updateById(id, data) {
    await this.prisma.alunoPlan.updateMany({
      where: { id },
      data,
    });

    return this.findById(id);
  }
}

module.exports = { AlunoPlanRepository };
