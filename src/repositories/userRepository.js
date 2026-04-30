class UserRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  create(data) {
    return this.prisma.user.create({ data });
  }

  findByEmail(email) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  findByEmailWithRelations(email) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        personalProfile: true,
      },
    });
  }

  findById(id) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  findByIdWithRelations(id) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        personalProfile: true,
      },
    });
  }
}

module.exports = { UserRepository };
