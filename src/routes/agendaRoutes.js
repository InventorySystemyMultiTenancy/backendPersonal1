const { Router } = require("express");
const { requireAuth } = require("../middlewares/authMiddleware");
const { allowRoles } = require("../middlewares/roleMiddleware");

function createAgendaRoutes(agendaController) {
  const router = Router();

  router.get(
    "/",
    requireAuth,
    allowRoles("PERSONAL"),
    agendaController.listForPersonal,
  );

  router.get(
    "/me",
    requireAuth,
    allowRoles("ALUNO"),
    agendaController.listForMe,
  );

  router.post(
    "/",
    requireAuth,
    allowRoles("PERSONAL"),
    agendaController.create,
  );

  router.patch(
    "/:id",
    requireAuth,
    allowRoles("PERSONAL"),
    agendaController.update,
  );

  router.delete(
    "/:id",
    requireAuth,
    allowRoles("PERSONAL"),
    agendaController.remove,
  );

  router.patch(
    "/:id/attendance",
    requireAuth,
    allowRoles("ALUNO"),
    agendaController.confirmAttendance,
  );

  router.patch(
    "/:id/request-cancel",
    requireAuth,
    allowRoles("ALUNO"),
    agendaController.requestCancel,
  );

  router.patch(
    "/:id/request-reschedule",
    requireAuth,
    allowRoles("ALUNO"),
    agendaController.requestReschedule,
  );

  router.patch(
    "/:id/review-request",
    requireAuth,
    allowRoles("PERSONAL"),
    agendaController.reviewChangeRequest,
  );

  return router;
}

module.exports = { createAgendaRoutes };
