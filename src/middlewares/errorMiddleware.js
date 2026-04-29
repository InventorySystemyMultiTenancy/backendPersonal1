const { AppError } = require("../utils/appError");

function errorMiddleware(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
    });
  }

  if (err.message === "Unauthorized") {
    return res.status(401).json({
      error: "Unauthorized",
    });
  }

  if (
    err.message === "Cross-tenant query blocked" ||
    err.message === "Tenant context missing for tenant-scoped model"
  ) {
    return res.status(403).json({
      error: "Forbidden",
    });
  }

  return res.status(500).json({
    error: "Internal server error",
  });
}

module.exports = { errorMiddleware };
