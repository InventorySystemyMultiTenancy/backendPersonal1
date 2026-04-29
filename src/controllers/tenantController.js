class TenantController {
  constructor(tenantService) {
    this.tenantService = tenantService;
  }

  resolve = async (req, res, next) => {
    try {
      const identifier = req.query.identifier || req.query.slug;
      const result = await this.tenantService.resolve(identifier);
      return res.status(200).json(result);
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { TenantController };
