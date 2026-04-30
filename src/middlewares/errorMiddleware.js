const { AppError } = require("../utils/appError");

function errorMiddleware(err, req, res, _next) {
  const errorContext = {
    method: req?.method,
    url: req?.originalUrl,
    authUserId: req?.auth?.userId || null,
    authPersonalId: req?.auth?.personalId || null,
    requestId: req?.headers?.['x-request-id'] || null,
  };

  try {
    console.error("[api:error:context]", JSON.stringify(errorContext));
  } catch (_contextErr) {
    // ignore logging errors
  }

  // Log full error and stack for remote debugging (visible in Render logs)
  try {
    console.error(err && err.stack ? err.stack : err);
  } catch (e) {
    // ignore logging errors
  }
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
    });
  }

  if (err?.code === "P2023") {
    return res.status(400).json({
      error: "Invalid ID format. Expected UUID.",
    });
  }

  if (err?.code === "P2002") {
    return res.status(409).json({
      error: "Unique field already in use",
    });
  }

  if (err?.code === "P2003") {
    return res.status(400).json({
      error: "Invalid related reference (check selected plan/student)",
    });
  }

  if (err?.code === "P2022") {
    return res.status(500).json({
      error: "Database schema is out of sync. Run latest migrations/bootstrap.",
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
