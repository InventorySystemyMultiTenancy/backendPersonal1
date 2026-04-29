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

  register = async (req, res, next) => {
    try {
      const result = await this.authService.register(req.body);
      return res.status(201).json(result);
    } catch (err) {
      return next(err);
    }
  };

  me = async (req, res, next) => {
    try {
      const result = await this.authService.me(req.auth);
      return res.status(200).json(result);
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { AuthController };
