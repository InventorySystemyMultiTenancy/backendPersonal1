const { AppError } = require("../utils/appError");

class TenantService {
  constructor(personalRepository) {
    this.personalRepository = personalRepository;
  }

  async resolve(identifier) {
    const normalized = String(identifier || "").trim();

    if (!normalized) {
      throw new AppError("identifier is required", 400);
    }

    const tenant =
      await this.personalRepository.findTenantByIdentifier(normalized);

    if (!tenant) {
      throw new AppError("Tenant not found", 404);
    }

    if (tenant.ambiguous) {
      return {
        ambiguous: true,
        options: tenant.options.map((item) => ({
          id: item.id,
          businessName: item.businessName,
          email: item.user?.email || null,
          status: item.status,
        })),
      };
    }

    return {
      ambiguous: false,
      tenant: {
        id: tenant.id,
        businessName: tenant.businessName,
        email: tenant.user?.email || null,
        status: tenant.status,
      },
    };
  }
}

module.exports = { TenantService };
