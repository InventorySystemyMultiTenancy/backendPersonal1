class CalculatorController {
  constructor(calculatorService) {
    this.calculatorService = calculatorService;
  }

  calculatePhysicalAssessment = async (req, res, next) => {
    try {
      const result = this.calculatorService.calculatePhysicalAssessment(req.body);
      return res.status(200).json({ result });
    } catch (err) {
      return next(err);
    }
  };

  estimateRunningPerformance = async (req, res, next) => {
    try {
      const result = this.calculatorService.estimateRunningPerformance(req.body);
      return res.status(200).json({ result });
    } catch (err) {
      return next(err);
    }
  };

  calculateRunningPace = async (req, res, next) => {
    try {
      const result = this.calculatorService.calculateRunningPace(req.body);
      return res.status(200).json({ result });
    } catch (err) {
      return next(err);
    }
  };

  calculateRunningCalories = async (req, res, next) => {
    try {
      const result = this.calculatorService.calculateRunningCalories(req.body);
      return res.status(200).json({ result });
    } catch (err) {
      return next(err);
    }
  };

  convertRunningDistance = async (req, res, next) => {
    try {
      const result = this.calculatorService.convertRunningDistance(req.body);
      return res.status(200).json({ result });
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { CalculatorController };
