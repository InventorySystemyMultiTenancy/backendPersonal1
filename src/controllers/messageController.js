class MessageController {
  constructor(messageService) {
    this.messageService = messageService;
  }

  // GET /messages/:alunoId  (personal only)
  listThread = async (req, res, next) => {
    try {
      const messages = await this.messageService.listAsPersonal(
        req.auth,
        req.params.alunoId,
      );
      return res.status(200).json({ messages });
    } catch (err) {
      return next(err);
    }
  };

  // POST /messages/:alunoId  (personal only)
  sendAsPersonal = async (req, res, next) => {
    try {
      const message = await this.messageService.sendAsPersonal(
        req.auth,
        req.params.alunoId,
        req.body?.content,
      );
      return res.status(201).json({ message });
    } catch (err) {
      return next(err);
    }
  };

  // GET /messages/me  (aluno only)
  listForMe = async (req, res, next) => {
    try {
      const messages = await this.messageService.listAsAluno(req.auth);
      return res.status(200).json({ messages });
    } catch (err) {
      return next(err);
    }
  };

  // POST /messages/me  (aluno only)
  sendAsAluno = async (req, res, next) => {
    try {
      const message = await this.messageService.sendAsAluno(
        req.auth,
        req.body?.content,
      );
      return res.status(201).json({ message });
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { MessageController };
