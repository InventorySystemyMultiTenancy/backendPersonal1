class AgendaRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  listForPersonal({ alunoId, from, to }) {
    const where = {};

    if (alunoId) {
      where.alunoId = alunoId;
    }

    if (from || to) {
      where.startsAt = {};
      if (from) where.startsAt.gte = from;
      if (to) where.startsAt.lte = to;
    }

    return this.prisma.agendaEvent.findMany({
      where,
      include: {
        aluno: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        workoutPlan: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: [{ startsAt: "asc" }],
    });
  }

  listForAluno(alunoId) {
    return this.prisma.agendaEvent.findMany({
      where: { alunoId },
      include: {
        workoutPlan: {
          select: {
            id: true,
            title: true,
            objective: true,
          },
        },
      },
      orderBy: [{ startsAt: "asc" }],
    });
  }

  listByWorkoutPlan(workoutPlanId, { from } = {}) {
    const where = { workoutPlanId };

    if (from) {
      where.startsAt = { gte: from };
    }

    return this.prisma.agendaEvent.findMany({
      where,
      orderBy: [{ startsAt: "asc" }],
    });
  }

  findById(id) {
    return this.prisma.agendaEvent.findFirst({
      where: { id },
      include: {
        aluno: {
          select: {
            id: true,
            fullName: true,
          },
        },
        workoutPlan: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });
  }

  create(data) {
    return this.prisma.agendaEvent.create({
      data,
      include: {
        aluno: {
          select: {
            id: true,
            fullName: true,
          },
        },
        workoutPlan: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });
  }

  createMany(events) {
    return this.prisma.$transaction(
      events.map((event) =>
        this.prisma.agendaEvent.create({
          data: event,
          include: {
            aluno: {
              select: {
                id: true,
                fullName: true,
              },
            },
            workoutPlan: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        }),
      ),
    );
  }

  async updateById(id, data) {
    await this.prisma.agendaEvent.updateMany({
      where: { id },
      data,
    });

    return this.findById(id);
  }

  async deleteById(id) {
    const deleted = await this.prisma.agendaEvent.deleteMany({
      where: { id },
    });

    return deleted.count > 0;
  }

  async deleteByWorkoutPlanId(workoutPlanId, { from } = {}) {
    const where = { workoutPlanId };

    if (from) {
      where.startsAt = { gte: from };
    }

    const deleted = await this.prisma.agendaEvent.deleteMany({ where });
    return deleted.count;
  }
}

module.exports = { AgendaRepository };
