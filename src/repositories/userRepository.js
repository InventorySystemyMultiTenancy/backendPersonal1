class UserRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  findByEmail(email) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  findById(id) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }
}

module.exports = { UserRepository };
