class AlunoController {
  constructor(alunoService) {
    this.alunoService = alunoService;
  }

  getAll = async (req, res, next) => {
    try {
      const alunos = await this.alunoService.getAllAlunos(req.auth);
      return res.status(200).json(alunos);
    } catch (err) {
      return next(err);
    }
  };

  getMe = async (req, res, next) => {
    try {
      const aluno = await this.alunoService.getMyProfile(req.auth);
      return res.status(200).json(aluno);
    } catch (err) {
      return next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const aluno = await this.alunoService.createAluno(req.auth, req.body);
      return res.status(201).json(aluno);
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { AlunoController };
