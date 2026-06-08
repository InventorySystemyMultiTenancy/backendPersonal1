class PersonalEventController {
  constructor(personalEventService) {
    this.personalEventService = personalEventService;
  }

  listForPersonal = async (req, res, next) => {
    try {
      const events = await this.personalEventService.listForPersonal(req.auth);
      return res.status(200).json({ events });
    } catch (err) {
      return next(err);
    }
  };

  listForMe = async (req, res, next) => {
    try {
      const events = await this.personalEventService.listForAluno(req.auth);
      return res.status(200).json({ events });
    } catch (err) {
      return next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const event = await this.personalEventService.create(req.auth, req.body);
      return res.status(201).json({ event });
    } catch (err) {
      return next(err);
    }
  };

  respond = async (req, res, next) => {
    try {
      const participant = await this.personalEventService.respond(
        req.auth,
        req.params.eventId,
        req.body?.status,
      );
      return res.status(200).json({ participant });
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { PersonalEventController };
