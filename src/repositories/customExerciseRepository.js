class CustomExerciseRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  findByPersonal(personalId) {
    return this.prisma.customExercise.findMany({
      where: {
        personalId,
        isActive: true,
      },
      orderBy: { muscleGroup: "asc", name: "asc" },
    });
  }

  findByPersonalAndGroup(personalId, muscleGroup) {
    return this.prisma.customExercise.findMany({
      where: {
        personalId,
        muscleGroup,
        isActive: true,
      },
      orderBy: { name: "asc" },
    });
  }

  create(data) {
    return this.prisma.customExercise.create({
      data: {
        personalId: data.personalId,
        name: data.name,
        muscleGroup: data.muscleGroup,
        equipment: data.equipment,
        isActive: true,
      },
    });
  }

  update(id, data) {
    return this.prisma.customExercise.update({
      where: { id },
      data: {
        name: data.name,
        muscleGroup: data.muscleGroup,
        equipment: data.equipment,
        isActive: data.isActive,
      },
    });
  }

  delete(id) {
    return this.prisma.customExercise.update({
      where: { id },
      data: { isActive: false },
    });
  }

  findById(id) {
    return this.prisma.customExercise.findUnique({
      where: { id },
    });
  }
}

module.exports = { CustomExerciseRepository };
