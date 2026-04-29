const { AppError } = require("../utils/appError");
const { isUuid } = require("../utils/validation");

class SubscriptionService {
  constructor(subscriptionPlanRepository, tenantSubscriptionRepository) {
    this.subscriptionPlanRepository = subscriptionPlanRepository;
    this.tenantSubscriptionRepository = tenantSubscriptionRepository;
  }

  listPublicPlans() {
    return this.subscriptionPlanRepository.listPublic();
  }

  listAdminPlans() {
    return this.subscriptionPlanRepository.listAdmin();
  }

  async createPlan(payload) {
    if (
      !payload.code ||
      !payload.name ||
      !payload.plan ||
      !payload.priceCents
    ) {
      throw new AppError("code, name, plan and priceCents are required", 400);
    }

    return this.subscriptionPlanRepository.create({
      code: String(payload.code).trim().toUpperCase(),
      name: payload.name,
      description: payload.description || null,
      plan: payload.plan,
      interval: payload.interval || "MONTHLY",
      priceCents: Number(payload.priceCents),
      currency: payload.currency || "BRL",
      isActive: payload.isActive !== false,
      sortOrder: Number(payload.sortOrder || 0),
    });
  }

  async patchPlanActive(code, isActive) {
    if (typeof isActive !== "boolean") {
      throw new AppError("isActive must be boolean", 400);
    }

    return this.subscriptionPlanRepository.updateByCode(
      String(code).trim().toUpperCase(),
      {
        isActive,
      },
    );
  }

  async createSubscription(authContext, payload) {
    if (!authContext?.personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    if (!payload?.planCode) {
      throw new AppError("planCode is required", 400);
    }

    const plan = await this.subscriptionPlanRepository.findByCode(
      String(payload.planCode).trim().toUpperCase(),
    );

    if (!plan || !plan.isActive) {
      throw new AppError("Plan not found or inactive", 404);
    }

    return this.tenantSubscriptionRepository.replaceActiveSubscription(
      authContext.personalId,
      {
        plan: plan.plan,
        subscriptionPlanId: plan.id,
      },
    );
  }

  async getMySubscription(authContext) {
    if (!authContext?.personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    return this.tenantSubscriptionRepository.findCurrentByPersonalId(
      authContext.personalId,
    );
  }

  async getSubscription(authContext, reference) {
    if (!isUuid(reference)) {
      throw new AppError("reference must be a valid UUID", 400);
    }

    const found = await this.tenantSubscriptionRepository.findById(reference);

    if (!found) {
      throw new AppError("Subscription not found", 404);
    }

    if (
      authContext.role !== "SUPER_ADMIN" &&
      found.personalId !== authContext.personalId
    ) {
      throw new AppError("Forbidden", 403);
    }

    return found;
  }

  async cancelSubscription(authContext, reference) {
    if (!authContext?.personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    if (!isUuid(reference)) {
      throw new AppError("reference must be a valid UUID", 400);
    }

    const result = await this.tenantSubscriptionRepository.cancelById(
      reference,
      authContext.personalId,
    );

    if (result.count === 0) {
      throw new AppError("Subscription not found", 404);
    }

    return { canceled: true };
  }
}

module.exports = { SubscriptionService };
