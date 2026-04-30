class DietController {
  constructor(dietService) {
    this.dietService = dietService;
  }

  listForPersonal = async (req, res, next) => {
    try {
      const diets = await this.dietService.listForPersonal(req.auth, req.query);
      return res.status(200).json({ diets });
    } catch (err) {
      return next(err);
    }
  };

  listForMe = async (req, res, next) => {
    try {
      const diets = await this.dietService.listForAluno(req.auth);
      return res.status(200).json({ diets });
    } catch (err) {
      return next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const diet = await this.dietService.create(req.auth, req.body);
      return res.status(201).json({ diet });
    } catch (err) {
      return next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const diet = await this.dietService.update(
        req.auth,
        req.params.id,
        req.body,
      );
      return res.status(200).json({ diet });
    } catch (err) {
      return next(err);
    }
  };

  remove = async (req, res, next) => {
    try {
      const result = await this.dietService.remove(req.auth, req.params.id);
      return res.status(200).json(result);
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { DietController };
