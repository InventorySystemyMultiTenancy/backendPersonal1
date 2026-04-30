class WorkoutPlanController {
  constructor(workoutPlanService) {
    this.workoutPlanService = workoutPlanService;
  }

  listByAluno = async (req, res, next) => {
    try {
      const plans = await this.workoutPlanService.listByAluno(
        req.auth,
        req.query.alunoId,
      );
      return res.status(200).json({ plans });
    } catch (err) {
      return next(err);
    }
  };

  listMine = async (req, res, next) => {
    try {
      const plans = await this.workoutPlanService.listMine(req.auth);
      return res.status(200).json({ plans });
    } catch (err) {
      return next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const plan = await this.workoutPlanService.create(req.auth, req.body);
      return res.status(201).json({ plan });
    } catch (err) {
      return next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const plan = await this.workoutPlanService.getById(
        req.auth,
        req.params.id,
      );
      return res.status(200).json({ plan });
    } catch (err) {
      return next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const plan = await this.workoutPlanService.update(
        req.auth,
        req.params.id,
        req.body,
      );
      return res.status(200).json({ plan });
    } catch (err) {
      return next(err);
    }
  };

  schedulePlan = async (req, res, next) => {
    try {
      const schedule = await this.workoutPlanService.schedulePlan(
        req.auth,
        req.params.id,
        req.body,
      );
      return res.status(200).json({ schedule });
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { WorkoutPlanController };
