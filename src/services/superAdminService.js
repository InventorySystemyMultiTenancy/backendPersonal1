const { AppError } = require("../utils/appError");
const { isUuid } = require("../utils/validation");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

class SuperAdminService {
  constructor(personalRepository) {
    this.personalRepository = personalRepository;
  }

  static normalizeSubdomain(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-|-$/g, "");
  }

  static isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  }

  static generateTemporaryPassword() {
    return `Tmp-${crypto.randomBytes(4).toString("hex")}`;
  }

  async getDashboardMetrics() {
    return this.personalRepository.getGlobalMetrics();
  }

  async getDashboardGrowth() {
    return this.personalRepository.getGrowthSeries();
  }

  async getRecentActivity(limitRaw) {
    const limit = Number(limitRaw || 10);
    return this.personalRepository.getRecentActivity(
      Number.isNaN(limit) ? 10 : limit,
    );
  }

  async getTenantOverview() {
    return this.personalRepository.listTenants();
  }

  async getBillingReport() {
    return this.personalRepository.getBillingReport();
  }

  async getPlansSummary() {
    return this.personalRepository.getPlansSummary();
  }

  async setTenantStatus(personalId, status) {
    if (!personalId) {
      throw new AppError("personalId is required", 400);
    }

    if (!isUuid(personalId)) {
      throw new AppError("personalId must be a valid UUID", 400);
    }

    const allowedStatus = ["ACTIVE", "INACTIVE", "SUSPENDED"];
    if (!allowedStatus.includes(String(status || "").toUpperCase())) {
      throw new AppError("Invalid tenant status", 400);
    }

    return this.personalRepository.updateTenantStatus(
      personalId,
      String(status).toUpperCase(),
    );
  }

  async createTenant(payload) {
    const email = String(payload?.email || "")
      .trim()
      .toLowerCase();
    const businessName = String(payload?.businessName || "").trim();
    const phone = payload?.phone ? String(payload.phone).trim() : null;
    const status = String(payload?.status || "ACTIVE").toUpperCase();
    const defaultPlan = String(payload?.defaultPlan || "FREE").toUpperCase();
    const subdomain = SuperAdminService.normalizeSubdomain(payload?.subdomain);

    if (!email || !businessName) {
      throw new AppError("email and businessName are required", 400);
    }

    if (!SuperAdminService.isValidEmail(email)) {
      throw new AppError("email must be valid", 400);
    }

    if (!subdomain) {
      throw new AppError("subdomain is required", 400);
    }

    const allowedStatus = ["ACTIVE", "INACTIVE", "SUSPENDED"];
    if (!allowedStatus.includes(status)) {
      throw new AppError("Invalid tenant status", 400);
    }

    const allowedPlans = ["FREE", "PRO", "PREMIUM"];
    if (!allowedPlans.includes(defaultPlan)) {
      throw new AppError("Invalid defaultPlan", 400);
    }

    const temporaryPassword = String(payload?.password || "").trim()
      ? String(payload.password)
      : SuperAdminService.generateTemporaryPassword();

    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const created = await this.personalRepository.createTenantWithUser({
      email,
      passwordHash,
      businessName,
      phone,
      subdomain,
      status,
      defaultPlan,
    });

    return {
      tenant: created,
      temporaryPassword,
    };
  }

  async updateTenant(personalId, payload) {
    if (!personalId || !isUuid(personalId)) {
      throw new AppError("personalId must be a valid UUID", 400);
    }

    const data = {};

    if (payload?.email !== undefined) {
      const email = String(payload.email || "")
        .trim()
        .toLowerCase();
      if (!email || !SuperAdminService.isValidEmail(email)) {
        throw new AppError("email must be valid", 400);
      }
      data.email = email;
    }

    if (payload?.businessName !== undefined) {
      const businessName = String(payload.businessName || "").trim();
      if (!businessName) {
        throw new AppError("businessName cannot be empty", 400);
      }
      data.businessName = businessName;
    }

    if (payload?.phone !== undefined) {
      data.phone = payload.phone ? String(payload.phone).trim() : null;
    }

    if (payload?.subdomain !== undefined) {
      const subdomain = SuperAdminService.normalizeSubdomain(payload.subdomain);
      if (!subdomain) {
        throw new AppError("subdomain cannot be empty", 400);
      }
      data.subdomain = subdomain;
    }

    if (Object.keys(data).length === 0) {
      throw new AppError("No updatable fields provided", 400);
    }

    const updated = await this.personalRepository.updateTenantProfile(
      personalId,
      data,
    );

    if (!updated) {
      throw new AppError("Tenant not found", 404);
    }

    return updated;
  }

  async deleteTenant(personalId) {
    if (!personalId || !isUuid(personalId)) {
      throw new AppError("personalId must be a valid UUID", 400);
    }

    const result = await this.personalRepository.deactivateTenant(personalId);

    if (!result) {
      throw new AppError("Tenant not found", 404);
    }

    return result;
  }
}

module.exports = { SuperAdminService };
