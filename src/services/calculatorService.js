const {
  calculatePhysicalAssessment,
} = require("./calculators/physicalAssessmentCalculator");
const {
  calculatePace,
  calculateRunningCalories,
  convertDistance,
  estimatePerformance,
} = require("./calculators/runningCalculator");

class CalculatorService {
  calculatePhysicalAssessment(payload) {
    return calculatePhysicalAssessment(payload || {});
  }

  estimateRunningPerformance(payload) {
    return estimatePerformance(payload || {});
  }

  calculateRunningPace(payload) {
    return calculatePace(payload || {});
  }

  calculateRunningCalories(payload) {
    return calculateRunningCalories(payload || {});
  }

  convertRunningDistance(payload) {
    return convertDistance(payload || {});
  }
}

module.exports = { CalculatorService };
