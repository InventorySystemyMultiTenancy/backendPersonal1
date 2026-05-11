class CustomExerciseController {
  constructor(customExerciseService) {
    this.customExerciseService = customExerciseService;
  }

  list = async (req, res, next) => {
    try {
      const exercises = await this.customExerciseService.listByPersonal(
        req.auth,
      );
      return res.status(200).json({ exercises });
    } catch (err) {
      return next(err);
    }
  };

  listByGroup = async (req, res, next) => {
    try {
      const { muscleGroup } = req.query;
      const exercises = await this.customExerciseService.listByGroup(
        req.auth,
        muscleGroup,
      );
      return res.status(200).json({ exercises });
    } catch (err) {
      return next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const exercise = await this.customExerciseService.create(
        req.auth,
        req.body,
      );
      return res.status(201).json({ exercise });
    } catch (err) {
      return next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const exercise = await this.customExerciseService.update(
        req.auth,
        req.params.id,
        req.body,
      );
      return res.status(200).json({ exercise });
    } catch (err) {
      return next(err);
    }
  };

  delete = async (req, res, next) => {
    try {
      await this.customExerciseService.delete(req.auth, req.params.id);
      return res.status(204).send();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { CustomExerciseController };
