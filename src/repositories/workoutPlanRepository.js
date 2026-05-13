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
            videoUrl: item.videoUrl || null,
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
              videoUrl: item.videoUrl || null,
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

  listTemplatesByPersonal(personalId) {
    return this.prisma.workoutTemplate.findMany({
      where: { personalId },
      include: {
        items: {
          orderBy: { orderIndex: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  findTemplateById(id, personalId) {
    return this.prisma.workoutTemplate.findFirst({
      where: {
        id,
        ...(personalId ? { personalId } : {}),
      },
      include: {
        items: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });
  }

  createTemplateWithItems(data) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.workoutTemplate.create({
        data: {
          personalId: data.personalId,
          title: data.title,
          objective: data.objective || null,
          isActive: data.isActive !== false,
        },
      });

      if (Array.isArray(data.items) && data.items.length > 0) {
        await tx.workoutTemplateItem.createMany({
          data: data.items.map((item, index) => ({
            workoutTemplateId: created.id,
            personalId: data.personalId,
            exerciseName: item.exerciseName,
            sets: Number(item.sets),
            reps: String(item.reps),
            restSeconds: item.restSeconds ? Number(item.restSeconds) : null,
            notes: item.notes || null,
            videoUrl: item.videoUrl || null,
            orderIndex: Number(item.orderIndex ?? index),
          })),
        });
      }

      return tx.workoutTemplate.findFirst({
        where: { id: created.id },
        include: {
          items: {
            orderBy: { orderIndex: "asc" },
          },
        },
      });
    });
  }

  createPlanFromTemplate(templateId, alunoId, personalId) {
    return this.prisma.$transaction(async (tx) => {
      const template = await tx.workoutTemplate.findFirst({
        where: {
          id: templateId,
          ...(personalId ? { personalId } : {}),
        },
        include: { items: true },
      });

      if (!template) {
        return null;
      }

      const created = await tx.workoutPlan.create({
        data: {
          alunoId,
          personalId: template.personalId,
          title: template.title,
          objective: template.objective || null,
          isActive: template.isActive,
        },
      });

      if (Array.isArray(template.items) && template.items.length > 0) {
        await tx.workoutPlanItem.createMany({
          data: template.items.map((item, index) => ({
            workoutPlanId: created.id,
            exerciseName: item.exerciseName,
            sets: Number(item.sets),
            reps: String(item.reps),
            restSeconds: item.restSeconds ? Number(item.restSeconds) : null,
            notes: item.notes || null,
            videoUrl: item.videoUrl || null,
            orderIndex: Number(item.orderIndex ?? index),
          })),
        });
      }

      return tx.workoutPlan.findFirst({
        where: { id: created.id },
        include: { items: { orderBy: { orderIndex: "asc" } } },
      });
    });
  }

  updateTemplateWithItems(id, data) {
    return this.prisma.$transaction(async (tx) => {
      await tx.workoutTemplate.updateMany({
        where: { id },
        data: {
          title: data.title,
          objective: data.objective || null,
          isActive: data.isActive,
        },
      });

      if (Array.isArray(data.items)) {
        await tx.workoutTemplateItem.deleteMany({
          where: { workoutTemplateId: id },
        });

        if (data.items.length > 0) {
          // Get the template to find personalId
          const template = await tx.workoutTemplate.findUnique({
            where: { id },
          });

          await tx.workoutTemplateItem.createMany({
            data: data.items.map((item, index) => ({
              workoutTemplateId: id,
              personalId: template.personalId,
              exerciseName: item.exerciseName,
              sets: Number(item.sets),
              reps: String(item.reps),
              restSeconds: item.restSeconds ? Number(item.restSeconds) : null,
              notes: item.notes || null,
              videoUrl: item.videoUrl || null,
              orderIndex: Number(item.orderIndex ?? index),
            })),
          });
        }
      }

      return tx.workoutTemplate.findFirst({
        where: { id },
        include: {
          items: {
            orderBy: { orderIndex: "asc" },
          },
        },
      });
    });
  }

  deleteTemplate(id) {
    return this.prisma.$transaction(async (tx) => {
      await tx.workoutTemplateItem.deleteMany({
        where: { workoutTemplateId: id },
      });

      return tx.workoutTemplate.delete({
        where: { id },
      });
    });
  }

  delete(id) {
    return this.prisma.$transaction(async (tx) => {
      await tx.workoutPlanItem.deleteMany({
        where: { workoutPlanId: id },
      });

      return tx.workoutPlan.delete({
        where: { id },
      });
    });
  }
}

module.exports = { WorkoutPlanRepository };
