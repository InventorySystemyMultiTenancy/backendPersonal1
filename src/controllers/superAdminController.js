class SuperAdminController {
  constructor(superAdminService) {
    this.superAdminService = superAdminService;
  }

  getDashboardMetrics = async (_req, res, next) => {
    try {
      const metrics = await this.superAdminService.getDashboardMetrics();
      return res.status(200).json(metrics);
    } catch (err) {
      return next(err);
    }
  };

  getDashboardGrowth = async (_req, res, next) => {
    try {
      const growth = await this.superAdminService.getDashboardGrowth();
      return res.status(200).json(growth);
    } catch (err) {
      return next(err);
    }
  };

  getRecentActivity = async (req, res, next) => {
    try {
      const activity = await this.superAdminService.getRecentActivity(
        req.query.limit,
      );
      return res.status(200).json(activity);
    } catch (err) {
      return next(err);
    }
  };

  getTenants = async (_req, res, next) => {
    try {
      const tenants = await this.superAdminService.getTenantOverview();
      return res.status(200).json(tenants);
    } catch (err) {
      return next(err);
    }
  };

  getBillingReport = async (_req, res, next) => {
    try {
      const report = await this.superAdminService.getBillingReport();
      return res.status(200).json(report);
    } catch (err) {
      return next(err);
    }
  };

  getPlansSummary = async (_req, res, next) => {
    try {
      const plans = await this.superAdminService.getPlansSummary();
      return res.status(200).json(plans);
    } catch (err) {
      return next(err);
    }
  };

  updateTenantStatus = async (req, res, next) => {
    try {
      const updated = await this.superAdminService.setTenantStatus(
        req.params.personalId,
        req.body.status,
      );
      return res.status(200).json(updated);
    } catch (err) {
      return next(err);
    }
  };

  createTenant = async (req, res, next) => {
    try {
      const created = await this.superAdminService.createTenant(req.body);
      return res.status(201).json(created);
    } catch (err) {
      return next(err);
    }
  };

  updateTenant = async (req, res, next) => {
    try {
      const updated = await this.superAdminService.updateTenant(
        req.params.personalId,
        req.body,
      );
      return res.status(200).json(updated);
    } catch (err) {
      return next(err);
    }
  };

  deleteTenant = async (req, res, next) => {
    try {
      const result = await this.superAdminService.deleteTenant(
        req.params.personalId,
      );
      return res.status(200).json(result);
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { SuperAdminController };
