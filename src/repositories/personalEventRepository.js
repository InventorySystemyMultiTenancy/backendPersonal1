const { randomUUID } = require("node:crypto");

class PersonalEventRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  listForPersonal() {
    return this.prisma.personalEvent.findMany({
      orderBy: { startsAt: "asc" },
      include: {
        participants: {
          include: {
            aluno: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
  }

  listForAluno(alunoId) {
    return this.prisma.personalEventParticipant.findMany({
      where: { alunoId },
      orderBy: {
        event: {
          startsAt: "asc",
        },
      },
      include: {
        event: true,
      },
    });
  }

  async createWithParticipants(authContext, eventData, alunoIds) {
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.personalEvent.create({
        data: {
          ...eventData,
          personalId: authContext.personalId,
        },
      });

      if (alunoIds.length > 0) {
        await tx.personalEventParticipant.createMany({
          data: alunoIds.map((alunoId) => ({
            id: randomUUID(),
            personalId: authContext.personalId,
            eventId: event.id,
            alunoId,
          })),
          skipDuplicates: true,
        });
      }

      return tx.personalEvent.findFirst({
        where: { id: event.id },
        include: {
          participants: {
            include: {
              aluno: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });
    });
  }

  async updateParticipantStatus({ eventId, alunoId, status }) {
    return this.prisma.personalEventParticipant.updateMany({
      where: { eventId, alunoId },
      data: {
        status,
        respondedAt: new Date(),
      },
    });
  }

  findParticipant(eventId, alunoId) {
    return this.prisma.personalEventParticipant.findFirst({
      where: { eventId, alunoId },
      include: {
        event: true,
      },
    });
  }
}

module.exports = { PersonalEventRepository };
