const { AppError } = require("../utils/appError");
const { isUuid } = require("../utils/validation");

class CustomExerciseService {
  constructor(customExerciseRepository) {
    this.customExerciseRepository = customExerciseRepository;
  }

  // Render can be temporarily out of sync (schema/client/migrations). Avoid hard 500 for list endpoints.
  isCustomExerciseStorageUnavailable(error) {
    if (!error) {
      return false;
    }

    const message = String(error.message || "").toLowerCase();

    return (
      error?.code === "P2021" ||
      error?.code === "P2022" ||
      message.includes("customexercise") ||
      message.includes("custom exercise") ||
      message.includes("cannot read properties of undefined")
    );
  }

  throwStorageUnavailable() {
    throw new AppError(
      "Custom exercises are temporarily unavailable. Run Prisma migrations and redeploy backend.",
      503,
    );
  }

  async listByPersonal(authContext) {
    if (!authContext?.personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    try {
      return await this.customExerciseRepository.findByPersonal(
        authContext.personalId,
      );
    } catch (error) {
      if (this.isCustomExerciseStorageUnavailable(error)) {
        return [];
      }
      throw error;
    }
  }

  async listByGroup(authContext, muscleGroup) {
    if (!authContext?.personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    if (!muscleGroup || typeof muscleGroup !== "string") {
      throw new AppError("muscleGroup is required and must be a string", 400);
    }

    try {
      return await this.customExerciseRepository.findByPersonalAndGroup(
        authContext.personalId,
        muscleGroup,
      );
    } catch (error) {
      if (this.isCustomExerciseStorageUnavailable(error)) {
        return [];
      }
      throw error;
    }
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
      if (this.isCustomExerciseStorageUnavailable(error)) {
        this.throwStorageUnavailable();
      }
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

    let exercise;
    try {
      exercise = await this.customExerciseRepository.findById(id);
    } catch (error) {
      if (this.isCustomExerciseStorageUnavailable(error)) {
        this.throwStorageUnavailable();
      }
      throw error;
    }
    if (!exercise) {
      throw new AppError("Exercise not found", 404);
    }

    if (exercise.personalId !== authContext.personalId) {
      throw new AppError("Unauthorized", 403);
    }

    try {
      return await this.customExerciseRepository.update(id, {
        name: payload.name || exercise.name,
        muscleGroup: payload.muscleGroup || exercise.muscleGroup,
        equipment: payload.equipment || exercise.equipment,
        isActive:
          payload.isActive !== undefined ? payload.isActive : exercise.isActive,
      });
    } catch (error) {
      if (this.isCustomExerciseStorageUnavailable(error)) {
        this.throwStorageUnavailable();
      }
      throw error;
    }
  }

  async delete(authContext, id) {
    if (!authContext?.personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    if (!isUuid(id)) {
      throw new AppError("id must be a valid UUID", 400);
    }

    let exercise;
    try {
      exercise = await this.customExerciseRepository.findById(id);
    } catch (error) {
      if (this.isCustomExerciseStorageUnavailable(error)) {
        this.throwStorageUnavailable();
      }
      throw error;
    }
    if (!exercise) {
      throw new AppError("Exercise not found", 404);
    }

    if (exercise.personalId !== authContext.personalId) {
      throw new AppError("Unauthorized", 403);
    }

    try {
      return await this.customExerciseRepository.delete(id);
    } catch (error) {
      if (this.isCustomExerciseStorageUnavailable(error)) {
        this.throwStorageUnavailable();
      }
      throw error;
    }
  }
}

module.exports = { CustomExerciseService };
