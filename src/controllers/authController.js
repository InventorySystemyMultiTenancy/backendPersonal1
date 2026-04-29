class AuthController {
  constructor(authService) {
    this.authService = authService;
  }

  login = async (req, res, next) => {
    try {
      const result = await this.authService.login(req.body);
      return res.status(200).json(result);
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { AuthController };
