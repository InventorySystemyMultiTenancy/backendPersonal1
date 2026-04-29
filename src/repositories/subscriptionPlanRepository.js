class SubscriptionPlanRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  listPublic() {
    return this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  }

  listAdmin() {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  }

  findByCode(code) {
    return this.prisma.subscriptionPlan.findUnique({
      where: { code },
    });
  }

  create(data) {
    return this.prisma.subscriptionPlan.create({
      data,
    });
  }

  updateByCode(code, data) {
    return this.prisma.subscriptionPlan.update({
      where: { code },
      data,
    });
  }
}

module.exports = { SubscriptionPlanRepository };
