const { AppError } = require("../utils/appError");
const { isUuid } = require("../utils/validation");
const {
  syncAlunoPlanWithMercadoPago,
} = require("./paymentRecurringService");

const ALLOWED_BILLING_INTERVAL_MONTHS = new Set([1, 3, 6, 12]);
const MAX_PLAN_IMAGE_URL_LENGTH = 2048;
const MAX_PLAN_IMAGE_DATA_URL_LENGTH = 8 * 1024 * 1024;

function normalizeBillingIntervalMonths(value, fallback = 1) {
  const interval = Number(value ?? fallback);
  if (!Number.isInteger(interval) || !ALLOWED_BILLING_INTERVAL_MONTHS.has(interval)) {
    throw new AppError(
      "billingIntervalMonths must be one of: 1, 3, 6, 12",
      400,
    );
  }
  return interval;
}

function normalizePlanImageUrl(payload, fallback) {
  const value =
    payload?.imageUrl !== undefined ? payload.imageUrl : payload?.image_url;

  if (value === undefined) {
    return fallback;
  }

  if (value === null || String(value).trim() === "") {
    return null;
  }

  const imageUrl = String(value).trim();

  if (/^data:image\//i.test(imageUrl)) {
    if (
      !/^data:image\/(png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(
        imageUrl,
      )
    ) {
      throw new AppError(
        "imageUrl data URL must be a base64 png, jpeg, webp or gif image",
        400,
      );
    }

    if (imageUrl.length > MAX_PLAN_IMAGE_DATA_URL_LENGTH) {
      throw new AppError("imageUrl image must be at most 8MB", 400);
    }

    return imageUrl;
  }

  if (imageUrl.length > MAX_PLAN_IMAGE_URL_LENGTH) {
    throw new AppError("imageUrl URL must be at most 2048 characters", 400);
  }

  if (!/^https?:\/\//i.test(imageUrl)) {
    throw new AppError("imageUrl must be an http(s) URL or data:image URL", 400);
  }

  return imageUrl;
}

function toAlunoPlanResponse(plan) {
  return {
    ...plan,
    image_url: plan.imageUrl || null,
    preapproval_plan_id: plan.mp_plan_id || null,
  };
}

class AlunoPlanService {
  constructor(alunoPlanRepository, alunoRepository, personalRepository) {
    this.alunoPlanRepository = alunoPlanRepository;
    this.alunoRepository = alunoRepository;
    this.personalRepository = personalRepository;
  }

  listPlans(authContext) {
    if (!authContext?.personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    return this.alunoPlanRepository
      .listAll()
      .then((plans) => plans.map(toAlunoPlanResponse));
  }

  listPublicPlans(personalId) {
    if (!personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    let resolvedPersonalId = String(personalId).trim();

    if (!isUuid(resolvedPersonalId)) {
      return this.personalRepository
        .findTenantByIdentifier(resolvedPersonalId)
        .then((tenant) => {
          if (!tenant) {
            throw new AppError("Tenant not found for provided personalId", 404);
          }

          if (tenant.ambiguous) {
            throw new AppError(
              "Ambiguous tenant identifier. Use tenant UUID (personalId).",
              400,
            );
          }

          return this.alunoPlanRepository
            .listPublicByPersonalId(tenant.id)
            .then((plans) => plans.map(toAlunoPlanResponse));
        });
    }

    return this.alunoPlanRepository
      .listPublicByPersonalId(resolvedPersonalId)
      .then((plans) => plans.map(toAlunoPlanResponse));
  }

  async createPlan(authContext, payload) {
    if (!authContext?.personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    if (!payload?.name || !payload?.monthlyPriceCents) {
      throw new AppError("name and monthlyPriceCents are required", 400);
    }

    const createdPlan = await this.alunoPlanRepository.create({
      personalId: authContext.personalId,
      name: payload.name,
      description: payload.description || null,
      imageUrl: normalizePlanImageUrl(payload, null),
      monthlyPriceCents: Number(payload.monthlyPriceCents),
      billingIntervalMonths: normalizeBillingIntervalMonths(
        payload.billingIntervalMonths,
      ),
      isActive: payload.isActive !== false,
    });

    try {
      const syncResult = await syncAlunoPlanWithMercadoPago({
        alunoPlanId: createdPlan.id,
        personalId: authContext.personalId,
      });

      return toAlunoPlanResponse(syncResult.plan);
    } catch (err) {
      // Mantém a regra "plano sempre sincronizado": se não sincronizar, não mantém plano criado.
      await this.alunoPlanRepository.deleteById(createdPlan.id);
      throw new AppError(
        `Falha ao sincronizar plano com Mercado Pago: ${err.message}`,
        502,
      );
    }
  }

  async updatePlan(authContext, id, payload) {
    if (!authContext?.personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    if (!isUuid(id)) {
      throw new AppError("id must be a valid UUID", 400);
    }

    const found = await this.alunoPlanRepository.findById(id);

    if (!found) {
      throw new AppError("Aluno plan not found", 404);
    }

    if (found.personalId !== authContext.personalId) {
      throw new AppError("Aluno plan not found", 404);
    }

    const nextBillingIntervalMonths =
      payload.billingIntervalMonths !== undefined
        ? normalizeBillingIntervalMonths(
            payload.billingIntervalMonths,
            found.billingIntervalMonths,
          )
        : found.billingIntervalMonths || 1;

    const nextMonthlyPriceCents =
      payload.monthlyPriceCents !== undefined
        ? Number(payload.monthlyPriceCents)
        : found.monthlyPriceCents;

    const syncRelevantFieldsChanged =
      (payload.name !== undefined && payload.name !== found.name) ||
      nextMonthlyPriceCents !== found.monthlyPriceCents ||
      nextBillingIntervalMonths !== (found.billingIntervalMonths || 1);

    const updated = await this.alunoPlanRepository.updateById(id, {
      name: payload.name ?? found.name,
      description: payload.description ?? found.description,
      imageUrl: normalizePlanImageUrl(payload, found.imageUrl),
      monthlyPriceCents: nextMonthlyPriceCents,
      billingIntervalMonths: nextBillingIntervalMonths,
      isActive:
        payload.isActive !== undefined
          ? Boolean(payload.isActive)
          : found.isActive,
      ...(syncRelevantFieldsChanged
        ? {
            mp_sync_status: "pending",
            mp_sync_error: null,
          }
        : {}),
    });

    if (!syncRelevantFieldsChanged || !updated.isActive) {
      return toAlunoPlanResponse(updated);
    }

    try {
      const syncResult = await syncAlunoPlanWithMercadoPago({
        alunoPlanId: updated.id,
        personalId: authContext.personalId,
        force: true,
      });

      return toAlunoPlanResponse(syncResult.plan);
    } catch (err) {
      throw new AppError(
        `Plano atualizado, mas falhou ao sincronizar com Mercado Pago: ${err.message}`,
        502,
      );
    }
  }

  async deletePlan(authContext, id) {
    if (!authContext?.personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    if (!isUuid(id)) {
      throw new AppError("id must be a valid UUID", 400);
    }

    const found = await this.alunoPlanRepository.findById(id);

    if (!found) {
      throw new AppError("Aluno plan not found", 404);
    }

    const deleted = await this.alunoPlanRepository.deleteById(id);
    if (!deleted) {
      throw new AppError("Aluno plan not found", 404);
    }

    return { deleted: true };
  }

  async assignPlanToAluno(authContext, alunoId, alunoPlanId) {
    if (!authContext?.personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    if (!isUuid(alunoId)) {
      throw new AppError("alunoId must be a valid UUID", 400);
    }

    if (alunoPlanId && !isUuid(alunoPlanId)) {
      throw new AppError("alunoPlanId must be a valid UUID", 400);
    }

    const aluno = await this.alunoRepository.findById(alunoId);

    if (!aluno) {
      throw new AppError("Aluno not found", 404);
    }

    if (alunoPlanId) {
      const plan = await this.alunoPlanRepository.findById(alunoPlanId);

      if (!plan || !plan.isActive) {
        throw new AppError("Aluno plan not found or inactive", 404);
      }
    }

    return this.alunoRepository.assignPlan(alunoId, alunoPlanId || null);
  }

  async assignPlanToMyProfile(authContext, alunoPlanId) {
    if (!authContext?.userId || !authContext?.personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    if (!isUuid(alunoPlanId)) {
      throw new AppError("alunoPlanId must be a valid UUID", 400);
    }

    const aluno = await this.alunoRepository.findByUserId(authContext.userId);

    if (!aluno) {
      throw new AppError("Aluno not found", 404);
    }

    const plan = await this.alunoPlanRepository.findById(alunoPlanId);

    if (!plan || !plan.isActive || plan.personalId !== authContext.personalId) {
      throw new AppError("Aluno plan not found", 404);
    }

    return this.alunoRepository.assignPlan(aluno.id, plan.id);
  }
}

module.exports = { AlunoPlanService };
