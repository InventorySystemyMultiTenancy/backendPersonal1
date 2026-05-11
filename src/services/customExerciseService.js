const { AppError } = require("../utils/appError");
const { isUuid } = require("../utils/validation");

class CustomExerciseService {
  constructor(customExerciseRepository) {
    this.customExerciseRepository = customExerciseRepository;
  }

  async listByPersonal(authContext) {
    if (!authContext?.personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    return this.customExerciseRepository.findByPersonal(authContext.personalId);
  }

  async listByGroup(authContext, muscleGroup) {
    if (!authContext?.personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    if (!muscleGroup || typeof muscleGroup !== "string") {
      throw new AppError("muscleGroup is required and must be a string", 400);
    }

    return this.customExerciseRepository.findByPersonalAndGroup(
      authContext.personalId,
      muscleGroup,
    );
  }

  async create(authContext, payload) {
    if (!authContext?.personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    if (!payload?.name || !payload?.muscleGroup || !payload?.equipment) {
      throw new AppError("name, muscleGroup, and equipment are required", 400);
    }

    const name = payload.name.trim();
    const muscleGroup = payload.muscleGroup.trim();
    const equipment = payload.equipment.trim();

    if (!name || !muscleGroup || !equipment) {
      throw new AppError(
        "name, muscleGroup, and equipment cannot be empty",
        400,
      );
    }

    try {
      return await this.customExerciseRepository.create({
        personalId: authContext.personalId,
        name,
        muscleGroup,
        equipment,
      });
    } catch (error) {
      if (error.code === "P2002") {
        throw new AppError(
          `Exercise "${name}" already exists in muscle group "${muscleGroup}"`,
          409,
        );
      }
      throw error;
    }
  }

  async update(authContext, id, payload) {
    if (!authContext?.personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    if (!isUuid(id)) {
      throw new AppError("id must be a valid UUID", 400);
    }

    const exercise = await this.customExerciseRepository.findById(id);
    if (!exercise) {
      throw new AppError("Exercise not found", 404);
    }

    if (exercise.personalId !== authContext.personalId) {
      throw new AppError("Unauthorized", 403);
    }

    return this.customExerciseRepository.update(id, {
      name: payload.name || exercise.name,
      muscleGroup: payload.muscleGroup || exercise.muscleGroup,
      equipment: payload.equipment || exercise.equipment,
      isActive:
        payload.isActive !== undefined ? payload.isActive : exercise.isActive,
    });
  }

  async delete(authContext, id) {
    if (!authContext?.personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    if (!isUuid(id)) {
      throw new AppError("id must be a valid UUID", 400);
    }

    const exercise = await this.customExerciseRepository.findById(id);
    if (!exercise) {
      throw new AppError("Exercise not found", 404);
    }

    if (exercise.personalId !== authContext.personalId) {
      throw new AppError("Unauthorized", 403);
    }

    return this.customExerciseRepository.delete(id);
  }
}

module.exports = { CustomExerciseService };
