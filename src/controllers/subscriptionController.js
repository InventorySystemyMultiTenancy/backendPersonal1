class SubscriptionController {
  constructor(subscriptionService) {
    this.subscriptionService = subscriptionService;
  }

  getPublicPlans = async (_req, res, next) => {
    try {
      const plans = await this.subscriptionService.listPublicPlans();
      return res.status(200).json({ plans });
    } catch (err) {
      return next(err);
    }
  };

  getAdminPlans = async (_req, res, next) => {
    try {
      const plans = await this.subscriptionService.listAdminPlans();
      return res.status(200).json({ plans });
    } catch (err) {
      return next(err);
    }
  };

  createPlan = async (req, res, next) => {
    try {
      const plan = await this.subscriptionService.createPlan(req.body);
      return res.status(201).json({ plan });
    } catch (err) {
      return next(err);
    }
  };

  patchPlanActive = async (req, res, next) => {
    try {
      const plan = await this.subscriptionService.patchPlanActive(
        req.params.code,
        req.body.isActive,
      );
      return res.status(200).json({ plan });
    } catch (err) {
      return next(err);
    }
  };

  createSubscription = async (req, res, next) => {
    try {
      const subscription = await this.subscriptionService.createSubscription(
        req.auth,
        req.body,
      );
      return res.status(201).json({ subscription });
    } catch (err) {
      return next(err);
    }
  };

  getMySubscription = async (req, res, next) => {
    try {
      const subscription = await this.subscriptionService.getMySubscription(
        req.auth,
      );
      return res.status(200).json({ subscription });
    } catch (err) {
      return next(err);
    }
  };

  getSubscription = async (req, res, next) => {
    try {
      const subscription = await this.subscriptionService.getSubscription(
        req.auth,
        req.params.reference,
      );
      return res.status(200).json({ subscription });
    } catch (err) {
      return next(err);
    }
  };

  cancelSubscription = async (req, res, next) => {
    try {
      const result = await this.subscriptionService.cancelSubscription(
        req.auth,
        req.params.reference,
      );
      return res.status(200).json(result);
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { SubscriptionController };
