class MessageRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  listThread(personalId, alunoId, { limit = 100 } = {}) {
    return this.prisma.message.findMany({
      where: { personalId, alunoId },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
  }

  create({ personalId, alunoId, senderRole, content }) {
    return this.prisma.message.create({
      data: { personalId, alunoId, senderRole, content },
    });
  }

  markReadByAluno(personalId, alunoId) {
    // Mark messages sent by PERSONAL as read (aluno is reading them)
    return this.prisma.message.updateMany({
      where: { personalId, alunoId, senderRole: "PERSONAL", readAt: null },
      data: { readAt: new Date() },
    });
  }

  markReadByPersonal(personalId, alunoId) {
    // Mark messages sent by ALUNO as read (personal is reading them)
    return this.prisma.message.updateMany({
      where: { personalId, alunoId, senderRole: "ALUNO", readAt: null },
      data: { readAt: new Date() },
    });
  }

  countUnreadForPersonal(personalId) {
    return this.prisma.message.count({
      where: { personalId, senderRole: "ALUNO", readAt: null },
    });
  }

  countUnreadForAluno(personalId, alunoId) {
    return this.prisma.message.count({
      where: { personalId, alunoId, senderRole: "PERSONAL", readAt: null },
    });
  }
}

module.exports = { MessageRepository };
