const assert = require("node:assert/strict");
const test = require("node:test");

const {
  calculatePhysicalAssessment,
} = require("../src/services/calculators/physicalAssessmentCalculator");
const {
  calculatePace,
  calculateRunningCalories,
  estimatePerformance,
} = require("../src/services/calculators/runningCalculator");

test("physical assessment calculates body composition and BMR", () => {
  const result = calculatePhysicalAssessment({
    sex: "M",
    age: 40,
    weightKg: 80,
    heightCm: 173,
    waistCm: 90,
    neckCm: 40,
  });

  assert.equal(result.bmi, 26.73);
  assert.equal(result.bmiClassification, "Sobrepeso");
  assert.equal(result.fatPercentage, 26.13);
  assert.equal(result.fatWeight, 20.91);
  assert.equal(result.leanMass, 59.09);
  assert.equal(result.basalMetabolicRate, 1686);
});

test("running performance uses Riegel exponent from the spreadsheet", () => {
  const result = estimatePerformance({
    distanceMeters: 3000,
    time: "00:15:15",
    targetDistancesMeters: [1000, 3000, 5000],
  });

  assert.equal(result.base.time, "15:15");
  assert.equal(result.estimates[0].time, "04:46");
  assert.equal(result.estimates[1].time, "15:15");
  assert.equal(result.estimates[2].time, "26:12");
});

test("running pace returns equivalent times for the same rhythm", () => {
  const result = calculatePace({
    distanceMeters: 5000,
    time: "00:30:00",
    targetDistancesMeters: [1000, 10000],
  });

  assert.equal(result.pacePerKm, "06:00");
  assert.equal(result.equivalentTimes[0].time, "06:00");
  assert.equal(result.equivalentTimes[1].time, "01:00:00");
});

test("running calories matches the spreadsheet sample", () => {
  const result = calculateRunningCalories({
    sex: "m",
    weightKg: 80,
    distanceKm: 10,
    timeMinutes: 55,
    heightCm: 173,
    age: 40,
  });

  assert.equal(result.runningCalories, 877);
  assert.equal(result.basalMetabolicRate, 1755);
  assert.equal(result.totalCaloriesWithBasal, 2632);
});
