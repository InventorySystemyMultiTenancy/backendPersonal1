const { AppError } = require("../utils/appError");

class AlunoRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  // Prisma extension injects personalId automatically based on request context.
  getAll(_authContext) {
    return this.prisma.aluno.findMany({
      include: {
        alunoPlan: true,
      },
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

  createWithWorkoutSetup(authContext, alunoData, workoutPlans) {
    return this.prisma.$transaction(async (tx) => {
      const aluno = await tx.aluno.create({
        data: {
          ...alunoData,
          personalId: authContext.personalId,
        },
      });

      for (const workout of workoutPlans) {
        let sourceItems = workout.items || [];
        let title = workout.title;
        let objective = workout.objective;
        let isActive = workout.isActive !== false;

        if (workout.templateId) {
          const template = await tx.workoutTemplate.findFirst({
            where: {
              id: workout.templateId,
              personalId: authContext.personalId,
            },
            include: {
              items: {
                orderBy: { orderIndex: "asc" },
              },
            },
          });

          if (!template) {
            throw new AppError("Template not found", 404);
          }

          sourceItems = template.items || [];
          title = workout.title || template.title;
          objective = workout.objective || template.objective || null;
          isActive = workout.isActive !== false && template.isActive !== false;
        }

        const createdWorkout = await tx.workoutPlan.create({
          data: {
            personalId: authContext.personalId,
            alunoId: aluno.id,
            title,
            objective: objective || null,
            isActive,
          },
        });

        if (sourceItems.length > 0) {
          await tx.workoutPlanItem.createMany({
            data: sourceItems.map((item, index) => ({
              personalId: authContext.personalId,
              workoutPlanId: createdWorkout.id,
              exerciseName: item.exerciseName,
              sets: Number(item.sets),
              reps: String(item.reps),
              restSeconds: item.restSeconds ? Number(item.restSeconds) : null,
              notes: item.notes || null,
              orderIndex: Number(item.orderIndex ?? index),
            })),
          });
        }

        if (!workout.templateId && workout.saveAsTemplate === true) {
          const createdTemplate = await tx.workoutTemplate.create({
            data: {
              personalId: authContext.personalId,
              title,
              objective: objective || null,
              isActive,
            },
          });

          if (sourceItems.length > 0) {
            await tx.workoutTemplateItem.createMany({
              data: sourceItems.map((item, index) => ({
                personalId: authContext.personalId,
                workoutTemplateId: createdTemplate.id,
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

        if (Array.isArray(workout.events) && workout.events.length > 0) {
          await tx.agendaEvent.createMany({
            data: workout.events.map((event) => ({
              personalId: authContext.personalId,
              alunoId: aluno.id,
              workoutPlanId: createdWorkout.id,
              type: "TREINO",
              recurrence: event.recurrence || "NONE",
              recurrenceUntil: event.recurrenceUntil || null,
              recurrenceGroupId: event.recurrenceGroupId || null,
              attendanceStatus: "PENDENTE",
              title: event.title || title,
              description: event.description || objective || null,
              dietNotes: null,
              startsAt: event.startsAt,
              endsAt: event.endsAt || null,
              isDone: false,
            })),
          });
        }
      }

      return tx.aluno.findFirst({
        where: { id: aluno.id },
        include: {
          alunoPlan: true,
          workoutPlans: {
            orderBy: { createdAt: "desc" },
            include: {
              items: {
                orderBy: { orderIndex: "asc" },
              },
              agendaEvents: {
                orderBy: { startsAt: "asc" },
              },
            },
          },
        },
      });
    });
  }

  findById(id) {
    return this.prisma.aluno.findFirst({
      where: { id },
      include: {
        alunoPlan: true,
      },
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

  async updateById(id, data) {
    await this.prisma.aluno.updateMany({
      where: { id },
      data,
    });

    return this.findById(id);
  }
}

module.exports = { AlunoRepository };
