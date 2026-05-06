const { AppError } = require("../utils/appError");

function errorMiddleware(err, req, res, _next) {
  const errorContext = {
    method: req?.method,
    url: req?.originalUrl,
    authUserId: req?.auth?.userId || null,
    authPersonalId: req?.auth?.personalId || null,
    requestId: req?.headers?.["x-request-id"] || null,
  };

  const errorSummary = {
    errorName: err?.name || null,
    errorCode: err?.code || null,
    errorMessage: err?.message || null,
  };

  try {
    console.error("[api:error:context]", JSON.stringify(errorContext));
    console.error(
      "[api:error]",
      JSON.stringify({ ...errorContext, ...errorSummary }),
    );
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

  // Map known recurring payment validation/business errors thrown as plain Error
  // into user-facing statuses instead of generic 500.
  if (
    req?.originalUrl?.startsWith("/payments/recurring") &&
    typeof err?.message === "string" &&
    err.message
  ) {
    const recurringMessage = err.message;

    const statusByMessage = new Map([
      ["aluno_id obrigatório", 400],
      ["card_token_id obrigatório", 400],
      ["personalId obrigatório para validação", 400],
      ["Email do assinante obrigatório", 400],
      ["Email do assinante inválido", 400],
      ["personalId inválido para listagem de planos", 400],
      ["Aluno não encontrado", 404],
      ["Plano não encontrado", 404],
      ["Plano de assinatura não encontrado", 404],
      ["Aluno não pertence a este personal", 403],
      ["Plano não pertence a este personal", 403],
      ["Plano de assinatura inativo ou não sincronizado", 409],
      ["Aluno já possui uma assinatura ativa", 409],
      ["Assinatura não encontrada", 404],
      ["Assinatura já cancelada", 409],
      ["Apenas assinatura ativa/autorizada pode ser cancelada", 409],
      ["Access Token do Mercado Pago não configurado", 500],
      ["Timeout ao comunicar com Mercado Pago", 504],
      ["Falha de comunicação com Mercado Pago", 502],
    ]);

    if (statusByMessage.has(recurringMessage)) {
      return res.status(statusByMessage.get(recurringMessage)).json({
        error: recurringMessage,
      });
    }

    if (recurringMessage.startsWith("Erro Mercado Pago (")) {
      return res.status(502).json({ error: recurringMessage });
    }
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
