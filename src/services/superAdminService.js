const { AppError } = require("../utils/appError");
const { isUuid } = require("../utils/validation");

class SuperAdminService {
  constructor(personalRepository) {
    this.personalRepository = personalRepository;
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
}

module.exports = { SuperAdminService };
