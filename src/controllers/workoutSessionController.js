class WorkoutSessionController {
  constructor(workoutSessionService) {
    this.workoutSessionService = workoutSessionService;
  }

  listForPersonal = async (req, res, next) => {
    try {
      const sessions = await this.workoutSessionService.listForPersonal(
        req.auth,
        req.query,
      );
      return res.status(200).json({ sessions });
    } catch (err) {
      return next(err);
    }
  };

  listForMe = async (req, res, next) => {
    try {
      const sessions = await this.workoutSessionService.listForAluno(
        req.auth,
        req.query,
      );
      return res.status(200).json({ sessions });
    } catch (err) {
      return next(err);
    }
  };

  start = async (req, res, next) => {
    try {
      const session = await this.workoutSessionService.start(
        req.auth,
        req.body,
      );
      return res.status(201).json({ session });
    } catch (err) {
      return next(err);
    }
  };

  finish = async (req, res, next) => {
    try {
      const session = await this.workoutSessionService.finish(
        req.auth,
        req.body,
      );
      return res.status(200).json({ session });
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { WorkoutSessionController };
