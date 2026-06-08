const { AppError } = require("../utils/appError");
const { isUuid } = require("../utils/validation");

class MessageService {
  constructor(messageRepository, alunoRepository) {
    this.messageRepository = messageRepository;
    this.alunoRepository = alunoRepository;
  }

  async remove(authContext, id) {
    if (!authContext?.role) {
      throw new AppError("Unauthorized", 401);
    }

    if (!isUuid(id)) {
      throw new AppError("id inválido", 400);
    }

    if (authContext.role === "PERSONAL") {
      if (!authContext.personalId) {
        throw new AppError("Unauthorized", 403);
      }

      const deleted = await this.messageRepository.deleteByIdForPersonal(
        id,
        authContext.personalId,
      );

      if (!deleted) {
        throw new AppError("Message not found", 404);
      }

      return;
    }

    if (authContext.role !== "ALUNO" || !authContext.userId) {
      throw new AppError("Unauthorized", 403);
    }

    const aluno = await this.alunoRepository.findByUserId(authContext.userId);
    if (!aluno) {
      throw new AppError("Aluno not found", 404);
    }

    const deleted = await this.messageRepository.deleteByConversation(
      id,
      aluno.personalId,
      aluno.id,
    );

    if (!deleted) {
      throw new AppError("Message not found", 404);
    }
  }

  // Personal lists conversation with a specific aluno
  async listAsPersonal(authContext, alunoId) {
    if (authContext?.role !== "PERSONAL" || !authContext.personalId) {
      throw new AppError("Unauthorized", 403);
    }
    if (!isUuid(alunoId)) throw new AppError("alunoId inválido", 400);

    // Verify aluno belongs to this personal
    const aluno = await this.alunoRepository.findById(alunoId);
    if (!aluno || aluno.personalId !== authContext.personalId) {
      throw new AppError("Aluno not found", 404);
    }

    // Mark aluno messages as read by personal
    await this.messageRepository.markReadByPersonal(
      authContext.personalId,
      alunoId,
    );

    return this.messageRepository.listThread(authContext.personalId, alunoId);
  }

  // Aluno lists their own conversation with their personal
  async listAsAluno(authContext) {
    if (authContext?.role !== "ALUNO" || !authContext.userId) {
      throw new AppError("Unauthorized", 403);
    }

    const aluno = await this.alunoRepository.findByUserId(authContext.userId);
    if (!aluno) throw new AppError("Aluno not found", 404);

    // Mark personal messages as read by aluno
    await this.messageRepository.markReadByAluno(aluno.personalId, aluno.id);

    return this.messageRepository.listThread(aluno.personalId, aluno.id);
  }

  // Personal sends message to aluno
  async sendAsPersonal(authContext, alunoId, content) {
    if (authContext?.role !== "PERSONAL" || !authContext.personalId) {
      throw new AppError("Unauthorized", 403);
    }
    if (!isUuid(alunoId)) throw new AppError("alunoId inválido", 400);
    if (!content || typeof content !== "string" || !content.trim()) {
      throw new AppError("Mensagem não pode estar vazia", 400);
    }

    const aluno = await this.alunoRepository.findById(alunoId);
    if (!aluno || aluno.personalId !== authContext.personalId) {
      throw new AppError("Aluno not found", 404);
    }

    return this.messageRepository.create({
      personalId: authContext.personalId,
      alunoId,
      senderRole: "PERSONAL",
      content: content.trim(),
    });
  }

  // Aluno sends message to their personal
  async sendAsAluno(authContext, content) {
    if (authContext?.role !== "ALUNO" || !authContext.userId) {
      throw new AppError("Unauthorized", 403);
    }
    if (!content || typeof content !== "string" || !content.trim()) {
      throw new AppError("Mensagem não pode estar vazia", 400);
    }

    const aluno = await this.alunoRepository.findByUserId(authContext.userId);
    if (!aluno) throw new AppError("Aluno not found", 404);

    return this.messageRepository.create({
      personalId: aluno.personalId,
      alunoId: aluno.id,
      senderRole: "ALUNO",
      content: content.trim(),
    });
  }
}

module.exports = { MessageService };
