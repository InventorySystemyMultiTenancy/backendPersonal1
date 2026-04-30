class AgendaController {
  constructor(agendaService) {
    this.agendaService = agendaService;
  }

  listForPersonal = async (req, res, next) => {
    try {
      const events = await this.agendaService.listForPersonal(
        req.auth,
        req.query,
      );
      return res.status(200).json({ events });
    } catch (err) {
      return next(err);
    }
  };

  listForMe = async (req, res, next) => {
    try {
      const events = await this.agendaService.listForAluno(req.auth);
      return res.status(200).json({ events });
    } catch (err) {
      return next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const event = await this.agendaService.create(req.auth, req.body);
      return res.status(201).json({ event });
    } catch (err) {
      return next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const event = await this.agendaService.update(
        req.auth,
        req.params.id,
        req.body,
      );
      return res.status(200).json({ event });
    } catch (err) {
      return next(err);
    }
  };

  remove = async (req, res, next) => {
    try {
      const result = await this.agendaService.remove(req.auth, req.params.id);
      return res.status(200).json(result);
    } catch (err) {
      return next(err);
    }
  };

  confirmAttendance = async (req, res, next) => {
    try {
      const event = await this.agendaService.confirmAttendance(
        req.auth,
        req.params.id,
        req.body?.attendanceStatus,
      );
      return res.status(200).json({ event });
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { AgendaController };
