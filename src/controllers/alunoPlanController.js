class AlunoPlanController {
  constructor(alunoPlanService) {
    this.alunoPlanService = alunoPlanService;
  }

  list = async (req, res, next) => {
    try {
      const plans = await this.alunoPlanService.listPlans(req.auth);
      return res.status(200).json({ plans });
    } catch (err) {
      return next(err);
    }
  };

  getPublicPlans = async (req, res, next) => {
    try {
      const personalId = req.headers["x-personal-id"] || req.query.personalId;
      const plans = await this.alunoPlanService.listPublicPlans(personalId);
      return res.status(200).json({ plans });
    } catch (err) {
      return next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const plan = await this.alunoPlanService.createPlan(req.auth, req.body);
      return res.status(201).json({ plan });
    } catch (err) {
      return next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const plan = await this.alunoPlanService.updatePlan(
        req.auth,
        req.params.id,
        req.body,
      );
      return res.status(200).json({ plan });
    } catch (err) {
      return next(err);
    }
  };

  remove = async (req, res, next) => {
    try {
      const result = await this.alunoPlanService.deletePlan(
        req.auth,
        req.params.id,
      );
      return res.status(200).json(result);
    } catch (err) {
      return next(err);
    }
  };

  assignToAluno = async (req, res, next) => {
    try {
      const aluno = await this.alunoPlanService.assignPlanToAluno(
        req.auth,
        req.params.alunoId,
        req.body.alunoPlanId,
      );
      return res.status(200).json({ aluno });
    } catch (err) {
      return next(err);
    }
  };

  assignToMe = async (req, res, next) => {
    try {
      const aluno = await this.alunoPlanService.assignPlanToMyProfile(
        req.auth,
        req.body.alunoPlanId,
      );
      return res.status(200).json({ aluno });
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { AlunoPlanController };
