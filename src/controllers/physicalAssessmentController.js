class PhysicalAssessmentController {
  constructor(physicalAssessmentService) {
    this.service = physicalAssessmentService;
  }

  listByAluno = async (req, res, next) => {
    try {
      const alunoId = req.params.alunoId || req.query.alunoId;
      const rows = await this.service.listByAluno(req.auth, alunoId);
      return res.status(200).json(rows || []);
    } catch (err) {
      return next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const payload = req.body;
      const created = await this.service.create(req.auth, payload);
      return res.status(201).json(created);
    } catch (err) {
      return next(err);
    }
  };

  remove = async (req, res, next) => {
    try {
      const id = req.params.id;
      const removed = await this.service.delete(req.auth, id);
      return res.status(200).json(removed);
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { PhysicalAssessmentController };
