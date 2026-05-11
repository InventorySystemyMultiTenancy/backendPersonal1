class WorkoutSessionRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  createStartedSession(data) {
    return this.prisma.workoutSessionLog.create({
      data: {
        personalId: data.personalId,
        alunoId: data.alunoId,
        workoutPlanId: data.workoutPlanId,
        startedAt: data.startedAt,
      },
      include: {
        workoutPlan: {
          select: {
            id: true,
            title: true,
          },
        },
        items: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });
  }

  findById(id) {
    return this.prisma.workoutSessionLog.findFirst({
      where: { id },
      include: {
        workoutPlan: {
          select: {
            id: true,
            title: true,
          },
        },
        aluno: {
          select: {
            id: true,
            fullName: true,
          },
        },
        items: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });
  }

  finishSession(id, data) {
    return this.prisma.$transaction(async (tx) => {
      await tx.workoutSessionLog.updateMany({
        where: { id },
        data: {
          finishedAt: data.finishedAt,
          durationSeconds: data.durationSeconds,
        },
      });

      await tx.workoutSessionLogItem.deleteMany({
        where: { workoutSessionLogId: id },
      });

      if (Array.isArray(data.items) && data.items.length > 0) {
        await tx.workoutSessionLogItem.createMany({
          data: data.items.map((item, index) => ({
            workoutSessionLogId: id,
            exerciseName: item.exerciseName,
            loadNotes: item.loadNotes || null,
            orderIndex: Number(item.orderIndex ?? index),
          })),
        });
      }

      return tx.workoutSessionLog.findFirst({
        where: { id },
        include: {
          workoutPlan: {
            select: {
              id: true,
              title: true,
            },
          },
          aluno: {
            select: {
              id: true,
              fullName: true,
            },
          },
          items: {
            orderBy: { orderIndex: "asc" },
          },
        },
      });
    });
  }

  listForPersonal({ personalId, alunoId, from, to }) {
    const where = {
      personalId,
    };

    if (alunoId) {
      where.alunoId = alunoId;
    }

    if (from || to) {
      where.startedAt = {};
      if (from) where.startedAt.gte = from;
      if (to) where.startedAt.lte = to;
    }

    return this.prisma.workoutSessionLog.findMany({
      where,
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
        items: {
          orderBy: { orderIndex: "asc" },
        },
      },
      orderBy: [{ startedAt: "desc" }],
    });
  }

  listForAluno(alunoId, { from, to } = {}) {
    const where = { alunoId };

    if (from || to) {
      where.startedAt = {};
      if (from) where.startedAt.gte = from;
      if (to) where.startedAt.lte = to;
    }

    return this.prisma.workoutSessionLog.findMany({
      where,
      include: {
        workoutPlan: {
          select: {
            id: true,
            title: true,
          },
        },
        items: {
          orderBy: { orderIndex: "asc" },
        },
      },
      orderBy: [{ startedAt: "desc" }],
    });
  }
}

module.exports = { WorkoutSessionRepository };
