const { verifyAccessToken } = require("../utils/jwt");
const { AppError } = require("../utils/appError");
const { setAuthContext } = require("../context/requestContext");

function authMiddleware(req, _res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    setAuthContext(null);
    return next();
  }

  const token = header.split(" ")[1];

  try {
    const payload = verifyAccessToken(token);

    req.auth = {
      userId: payload.sub,
      role: payload.role,
      personalId: payload.personalId || null,
      email: payload.email || null,
    };

    setAuthContext(req.auth);

    return next();
  } catch (_err) {
    return next(new AppError("Invalid or expired token", 401));
  }
}

function requireAuth(req, _res, next) {
  if (!req.auth || !req.auth.userId) {
    return next(new AppError("Unauthorized", 401));
  }

  return next();
}

module.exports = {
  authMiddleware,
  requireAuth,
};
