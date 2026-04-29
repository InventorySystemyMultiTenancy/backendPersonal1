class WorkoutPlanRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  listByAluno(alunoId) {
    return this.prisma.workoutPlan.findMany({
      where: { alunoId },
      include: {
        items: {
          orderBy: { orderIndex: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id) {
    return this.prisma.workoutPlan.findFirst({
      where: { id },
      include: {
        items: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });
  }

  createWithItems(data) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.workoutPlan.create({
        data: {
          alunoId: data.alunoId,
          title: data.title,
          objective: data.objective || null,
          isActive: data.isActive !== false,
        },
      });

      if (Array.isArray(data.items) && data.items.length > 0) {
        await tx.workoutPlanItem.createMany({
          data: data.items.map((item, index) => ({
            workoutPlanId: created.id,
            exerciseName: item.exerciseName,
            sets: Number(item.sets),
            reps: String(item.reps),
            restSeconds: item.restSeconds ? Number(item.restSeconds) : null,
            notes: item.notes || null,
            orderIndex: Number(item.orderIndex ?? index),
          })),
        });
      }

      return tx.workoutPlan.findFirst({
        where: { id: created.id },
        include: {
          items: {
            orderBy: { orderIndex: "asc" },
          },
        },
      });
    });
  }

  updateWithItems(id, data) {
    return this.prisma.$transaction(async (tx) => {
      await tx.workoutPlan.updateMany({
        where: { id },
        data: {
          title: data.title,
          objective: data.objective || null,
          isActive: data.isActive,
        },
      });

      if (Array.isArray(data.items)) {
        await tx.workoutPlanItem.deleteMany({
          where: { workoutPlanId: id },
        });

        if (data.items.length > 0) {
          await tx.workoutPlanItem.createMany({
            data: data.items.map((item, index) => ({
              workoutPlanId: id,
              exerciseName: item.exerciseName,
              sets: Number(item.sets),
              reps: String(item.reps),
              restSeconds: item.restSeconds ? Number(item.restSeconds) : null,
              notes: item.notes || null,
              orderIndex: Number(item.orderIndex ?? index),
            })),
          });
        }
      }

      return tx.workoutPlan.findFirst({
        where: { id },
        include: {
          items: {
            orderBy: { orderIndex: "asc" },
          },
        },
      });
    });
  }
}

module.exports = { WorkoutPlanRepository };
