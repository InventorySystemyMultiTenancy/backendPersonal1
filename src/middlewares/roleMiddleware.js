const { AppError } = require("../utils/appError");

function allowRoles(...roles) {
  return function roleMiddleware(req, _res, next) {
    if (!req.auth || !req.auth.role) {
      return next(new AppError("Unauthorized", 401));
    }

    if (!roles.includes(req.auth.role)) {
      return next(new AppError("Forbidden", 403));
    }

    return next();
  };
}

module.exports = { allowRoles };
