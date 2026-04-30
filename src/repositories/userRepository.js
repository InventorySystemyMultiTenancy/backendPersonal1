class UserRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  create(data) {
    return this.prisma.user.create({ data });
  }

  findByEmail(email) {
    const normalizedEmail = this.normalizeEmail(email);
    return this.prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
    });
  }

  findByEmailWithRelations(email) {
    const normalizedEmail = this.normalizeEmail(email);
    return this.prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
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
