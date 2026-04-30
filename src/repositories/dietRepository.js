class DietRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  listForPersonal({ alunoId }) {
    return this.prisma.dietPlan.findMany({
      where: alunoId ? { alunoId } : {},
      include: {
        aluno: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        days: {
          orderBy: { weekday: "asc" },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    });
  }

  listForAluno(alunoId) {
    return this.prisma.dietPlan.findMany({
      where: { alunoId },
      include: {
        days: {
          orderBy: { weekday: "asc" },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    });
  }

  findById(id) {
    return this.prisma.dietPlan.findFirst({
      where: { id },
      include: {
        aluno: {
          select: {
            id: true,
            fullName: true,
          },
        },
        days: {
          orderBy: { weekday: "asc" },
        },
      },
    });
  }

  createWithDays(data) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.dietPlan.create({
        data: {
          alunoId: data.alunoId,
          title: data.title,
          description: data.description || null,
        },
      });

      await tx.dietPlanDay.createMany({
        data: data.days.map((day) => ({
          dietPlanId: created.id,
          weekday: day.weekday,
          mealPlan: day.mealPlan,
        })),
      });

      return tx.dietPlan.findFirst({
        where: { id: created.id },
        include: {
          aluno: {
            select: {
              id: true,
              fullName: true,
            },
          },
          days: {
            orderBy: { weekday: "asc" },
          },
        },
      });
    });
  }

  updateWithDays(id, data) {
    return this.prisma.$transaction(async (tx) => {
      await tx.dietPlan.updateMany({
        where: { id },
        data: {
          alunoId: data.alunoId,
          title: data.title,
          description: data.description || null,
        },
      });

      await tx.dietPlanDay.deleteMany({
        where: { dietPlanId: id },
      });

      await tx.dietPlanDay.createMany({
        data: data.days.map((day) => ({
          dietPlanId: id,
          weekday: day.weekday,
          mealPlan: day.mealPlan,
        })),
      });

      return tx.dietPlan.findFirst({
        where: { id },
        include: {
          aluno: {
            select: {
              id: true,
              fullName: true,
            },
          },
          days: {
            orderBy: { weekday: "asc" },
          },
        },
      });
    });
  }

  async deleteById(id) {
    const deleted = await this.prisma.dietPlan.deleteMany({
      where: { id },
    });

    return deleted.count > 0;
  }
}

module.exports = { DietRepository };
