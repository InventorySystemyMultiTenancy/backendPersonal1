const { AppError } = require("../../utils/appError");

function toNumber(value, fieldName, { required = true, min = null } = {}) {
  if (value === undefined || value === null || value === "") {
    if (!required) {
      return null;
    }
    throw new AppError(`${fieldName} is required`, 400);
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new AppError(`${fieldName} must be a valid number`, 400);
  }

  if (min !== null && parsed < min) {
    throw new AppError(`${fieldName} must be greater than or equal to ${min}`, 400);
  }

  return parsed;
}

function normalizeSex(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (["M", "MALE", "MASCULINO"].includes(normalized)) {
    return "M";
  }
  if (["F", "FEMALE", "FEMININO"].includes(normalized)) {
    return "F";
  }
  throw new AppError("sex must be M or F", 400);
}

function round(value, decimals = 2) {
  if (!Number.isFinite(value)) {
    return null;
  }

  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function classifyBmi(bmi) {
  if (bmi < 18.5) {
    return "Abaixo do peso";
  }
  if (bmi < 25) {
    return "Peso Normal";
  }
  if (bmi < 30) {
    return "Sobrepeso";
  }
  if (bmi < 35) {
    return "Obesidade I";
  }
  if (bmi < 40) {
    return "Obesidade II";
  }
  return "Obesidade III";
}

function calculateBodyFatPercentage({ sex, heightCm, waistCm, neckCm, hipCm }) {
  if (sex === "M") {
    if (waistCm <= neckCm) {
      throw new AppError("waistCm must be greater than neckCm for male assessments", 400);
    }

    return (
      86.01 * Math.log10(waistCm - neckCm) -
      70.041 * Math.log10(heightCm) +
      36.76
    );
  }

  if (hipCm === null) {
    throw new AppError("hipCm is required for female assessments", 400);
  }

  if (waistCm + hipCm <= neckCm) {
    throw new AppError(
      "waistCm plus hipCm must be greater than neckCm for female assessments",
      400,
    );
  }

  return (
    163.205 * Math.log10(waistCm + hipCm - neckCm) -
    97.684 * Math.log10(heightCm) -
    78.387
  );
}

function calculateBasalMetabolicRate({ sex, age, weightKg, heightCm }) {
  if (sex === "M") {
    return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  }

  return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
}

function calculatePhysicalAssessment(input) {
  const sex = normalizeSex(input.sex || input.gender || input.sexo);
  const age = toNumber(input.age || input.idade, "age", { min: 0 });
  const weightKg = toNumber(input.weightKg || input.weight || input.peso, "weightKg", {
    min: 1,
  });
  const heightCm = toNumber(input.heightCm || input.altura || input.height, "heightCm", {
    min: 1,
  });
  const waistCm = toNumber(input.waistCm || input.cintura, "waistCm", { min: 1 });
  const neckCm = toNumber(input.neckCm || input.pescoco || input.pescoço, "neckCm", {
    min: 1,
  });
  const hipCm = toNumber(input.hipCm || input.quadril, "hipCm", {
    required: sex === "F",
    min: 1,
  });

  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  const fatPercentage = calculateBodyFatPercentage({
    sex,
    heightCm,
    waistCm,
    neckCm,
    hipCm,
  });
  const fatWeight = weightKg * (fatPercentage / 100);
  const leanMass = weightKg - fatWeight;
  const leanMassPercentage = 100 - fatPercentage;
  const basalMetabolicRate = calculateBasalMetabolicRate({
    sex,
    age,
    weightKg,
    heightCm,
  });

  return {
    sex,
    age,
    weightKg: round(weightKg),
    heightCm: round(heightCm),
    waistCm: round(waistCm),
    neckCm: round(neckCm),
    hipCm: hipCm === null ? null : round(hipCm),
    bmi: round(bmi),
    bmiClassification: classifyBmi(bmi),
    fatPercentage: round(fatPercentage),
    fatWeight: round(fatWeight),
    leanMass: round(leanMass),
    leanMassPercentage: round(leanMassPercentage),
    basalMetabolicRate: round(basalMetabolicRate, 0),
    calculationMethod: "US_NAVY_BODY_FAT_MIFFLIN_ST_JEOR_BMR",
  };
}

module.exports = {
  calculatePhysicalAssessment,
  classifyBmi,
};
