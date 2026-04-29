class AlunoRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  // Prisma extension injects personalId automatically based on request context.
  getAll(_authContext) {
    return this.prisma.aluno.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  create(authContext, data) {
    return this.prisma.aluno.create({
      data: {
        ...data,
        personalId: authContext.personalId,
      },
    });
  }

  findById(id) {
    return this.prisma.aluno.findFirst({
      where: { id },
    });
  }

  findByUserId(userId) {
    return this.prisma.aluno.findFirst({
      where: { userId },
    });
  }

  findProfileByUserId(userId) {
    return this.prisma.aluno.findFirst({
      where: { userId },
      include: {
        alunoPlan: true,
        workoutPlans: {
          orderBy: { createdAt: "desc" },
          include: {
            items: {
              orderBy: { orderIndex: "asc" },
            },
          },
        },
      },
    });
  }

  async assignPlan(id, alunoPlanId) {
    await this.prisma.aluno.updateMany({
      where: { id },
      data: {
        alunoPlanId,
      },
    });

    return this.findById(id);
  }
}

module.exports = { AlunoRepository };
