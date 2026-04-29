class TenantSubscriptionRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  findCurrentByPersonalId(personalId) {
    return this.prisma.tenantSubscription.findFirst({
      where: {
        personalId,
        isActive: true,
      },
      include: {
        subscriptionPlan: true,
      },
      orderBy: { startedAt: "desc" },
    });
  }

  findById(id) {
    return this.prisma.tenantSubscription.findFirst({
      where: { id },
      include: {
        subscriptionPlan: true,
      },
    });
  }

  async replaceActiveSubscription(personalId, planData) {
    await this.prisma.tenantSubscription.updateMany({
      where: {
        personalId,
        isActive: true,
      },
      data: {
        isActive: false,
        endsAt: new Date(),
      },
    });

    return this.prisma.tenantSubscription.create({
      data: {
        personalId,
        plan: planData.plan,
        subscriptionPlanId: planData.subscriptionPlanId,
        startedAt: new Date(),
        isActive: true,
      },
      include: {
        subscriptionPlan: true,
      },
    });
  }

  cancelById(id, personalId) {
    return this.prisma.tenantSubscription.updateMany({
      where: {
        id,
        personalId,
        isActive: true,
      },
      data: {
        isActive: false,
        endsAt: new Date(),
      },
    });
  }
}

module.exports = { TenantSubscriptionRepository };
