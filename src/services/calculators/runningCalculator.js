const { AppError } = require("../../utils/appError");

const MILE_IN_METERS = 1609.34;

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

function round(value, decimals = 2) {
  if (!Number.isFinite(value)) {
    return null;
  }

  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function parseTimeToSeconds(value, fieldName = "time") {
  if (typeof value === "number") {
    return toNumber(value, fieldName, { min: 0 });
  }

  if (typeof value !== "string") {
    throw new AppError(`${fieldName} must be seconds or hh:mm:ss`, 400);
  }

  const parts = value.trim().split(":").map(Number);
  if (![2, 3].includes(parts.length) || parts.some((part) => !Number.isFinite(part))) {
    throw new AppError(`${fieldName} must use mm:ss or hh:mm:ss format`, 400);
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

function formatSeconds(totalSeconds) {
  const rounded = Math.round(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;
  const left = hours > 0 ? String(hours).padStart(2, "0") : null;
  const middle = String(minutes).padStart(2, "0");
  const right = String(seconds).padStart(2, "0");

  return left ? `${left}:${middle}:${right}` : `${middle}:${right}`;
}

function secondsFromPayload(payload, field = "time") {
  if (payload.timeSeconds !== undefined) {
    return toNumber(payload.timeSeconds, "timeSeconds", { min: 1 });
  }

  if (payload[field] !== undefined) {
    return parseTimeToSeconds(payload[field], field);
  }

  if (payload.hours !== undefined || payload.minutes !== undefined || payload.seconds !== undefined) {
    const hours = toNumber(payload.hours || 0, "hours", { min: 0 });
    const minutes = toNumber(payload.minutes || 0, "minutes", { min: 0 });
    const seconds = toNumber(payload.seconds || 0, "seconds", { min: 0 });
    const total = hours * 3600 + minutes * 60 + seconds;
    if (total <= 0) {
      throw new AppError("time must be greater than zero", 400);
    }
    return total;
  }

  throw new AppError("timeSeconds or time is required", 400);
}

function paceFromDistanceAndTime(distanceMeters, timeSeconds) {
  const paceSecondsPerKm = timeSeconds / (distanceMeters / 1000);
  const paceSecondsPerMile = timeSeconds / (distanceMeters / MILE_IN_METERS);

  return {
    paceSecondsPerKm: round(paceSecondsPerKm, 2),
    pacePerKm: formatSeconds(paceSecondsPerKm),
    paceSecondsPerMile: round(paceSecondsPerMile, 2),
    pacePerMile: formatSeconds(paceSecondsPerMile),
    speedKmh: round((distanceMeters / 1000) / (timeSeconds / 3600), 2),
  };
}

function estimatePerformance(payload) {
  const baseDistanceMeters = toNumber(
    payload.distanceMeters || payload.baseDistanceMeters,
    "distanceMeters",
    { min: 1 },
  );
  const baseTimeSeconds = secondsFromPayload(payload);
  const exponent = toNumber(payload.exponent || 1.06, "exponent", {
    required: false,
    min: 0.1,
  });
  const distances = Array.isArray(payload.targetDistancesMeters)
    ? payload.targetDistancesMeters
    : [100, 200, 400, 800, 1000, 1500, 1609, 2000, 3000, 4000, 5000, 8000, 10000, 15000, 20000, 21096.84, 25000, 30000, 42200];

  const estimates = distances.map((distance) => {
    const distanceMeters = toNumber(distance, "targetDistancesMeters", { min: 1 });
    const estimatedTimeSeconds =
      baseTimeSeconds * (distanceMeters / baseDistanceMeters) ** exponent;

    return {
      distanceMeters: round(distanceMeters, 2),
      timeSeconds: round(estimatedTimeSeconds, 2),
      time: formatSeconds(estimatedTimeSeconds),
      ...paceFromDistanceAndTime(distanceMeters, estimatedTimeSeconds),
    };
  });

  return {
    base: {
      distanceMeters: round(baseDistanceMeters, 2),
      timeSeconds: round(baseTimeSeconds, 2),
      time: formatSeconds(baseTimeSeconds),
      ...paceFromDistanceAndTime(baseDistanceMeters, baseTimeSeconds),
    },
    exponent,
    estimates,
  };
}

function calculatePace(payload) {
  const distanceMeters = toNumber(payload.distanceMeters, "distanceMeters", { min: 1 });
  const timeSeconds = secondsFromPayload(payload);
  const targetDistances = Array.isArray(payload.targetDistancesMeters)
    ? payload.targetDistancesMeters
    : [100, 400, 800, 1000, 5000, 10000, 21097.5, 42195];

  return {
    distanceMeters: round(distanceMeters, 2),
    timeSeconds: round(timeSeconds, 2),
    time: formatSeconds(timeSeconds),
    ...paceFromDistanceAndTime(distanceMeters, timeSeconds),
    equivalentTimes: targetDistances.map((distance) => {
      const targetDistanceMeters = toNumber(distance, "targetDistancesMeters", { min: 1 });
      const equivalentTimeSeconds = (timeSeconds / distanceMeters) * targetDistanceMeters;

      return {
        distanceMeters: round(targetDistanceMeters, 2),
        timeSeconds: round(equivalentTimeSeconds, 2),
        time: formatSeconds(equivalentTimeSeconds),
      };
    }),
  };
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

function calculateRunningCalories(payload) {
  const weightKg = toNumber(payload.weightKg || payload.weight, "weightKg", { min: 1 });
  const distanceKm = toNumber(payload.distanceKm, "distanceKm", { min: 0.01 });
  const timeMinutes = toNumber(payload.timeMinutes, "timeMinutes", { min: 0.01 });
  const heightCm = toNumber(payload.heightCm || payload.height, "heightCm", { min: 1 });
  const age = toNumber(payload.age, "age", { min: 0 });
  const sex = normalizeSex(payload.sex || payload.gender);

  const speedMetersPerMinute = (distanceKm * 1000) / timeMinutes;
  const runningCalories =
    ((0.2 * speedMetersPerMinute + 3.5) * weightKg * timeMinutes) / 200;
  const basalMetabolicRate =
    sex === "M"
      ? 66 + 13.7 * weightKg + 5 * heightCm - 6.8 * age
      : 655 + 9.6 * weightKg + 1.8 * heightCm - 4.7 * age;

  return {
    sex,
    weightKg: round(weightKg),
    distanceKm: round(distanceKm),
    timeMinutes: round(timeMinutes),
    heightCm: round(heightCm),
    age: round(age, 0),
    runningCalories: round(runningCalories, 0),
    basalMetabolicRate: round(basalMetabolicRate, 0),
    totalCaloriesWithBasal: round(runningCalories + basalMetabolicRate, 0),
    speedKmh: round(distanceKm / (timeMinutes / 60), 2),
  };
}

function convertDistance(payload) {
  if (payload.miles !== undefined) {
    const miles = toNumber(payload.miles, "miles", { min: 0 });
    return { miles: round(miles, 3), kilometers: round(miles * 1.60934, 3) };
  }

  const kilometers = toNumber(payload.kilometers, "kilometers", { min: 0 });
  return { kilometers: round(kilometers, 3), miles: round(kilometers / 1.60934, 3) };
}

module.exports = {
  calculatePace,
  calculateRunningCalories,
  convertDistance,
  estimatePerformance,
  formatSeconds,
  parseTimeToSeconds,
};
