const { AppError } = require("./appError");

function assertTenantContext(authContext) {
  if (!authContext) {
    throw new AppError("Authentication context is missing", 401);
  }

  if (authContext.role === "SUPER_ADMIN") {
    return;
  }

  if (!authContext.personalId) {
    throw new AppError("Tenant context is missing", 403);
  }
}

function scopedWhere(authContext, extraWhere = {}) {
  assertTenantContext(authContext);

  if (authContext.role === "SUPER_ADMIN") {
    return { ...extraWhere };
  }

  return {
    personalId: authContext.personalId,
    ...extraWhere,
  };
}

module.exports = {
  assertTenantContext,
  scopedWhere,
};
