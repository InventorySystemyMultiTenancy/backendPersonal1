const bcrypt = require("bcryptjs");
const { AppError } = require("../utils/appError");
const { signAccessToken } = require("../utils/jwt");
const { isUuid } = require("../utils/validation");

const AUTH_DEBUG_LOGS = String(process.env.AUTH_DEBUG_LOGS || "").trim() === "true";

function logAuth(event, payload) {
  if (!AUTH_DEBUG_LOGS) return;
  console.log(`[auth:${event}]`, JSON.stringify(payload));
}

class AuthService {
  constructor(userRepository, personalRepository) {
    this.userRepository = userRepository;
    this.personalRepository = personalRepository;
  }

  async login({ email, password }) {
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail || !password) {
      logAuth("login:validation-error", {
        hasEmail: Boolean(normalizedEmail),
        hasPassword: Boolean(password),
      });
      throw new AppError("Email and password are required", 400);
    }

    const user = await this.userRepository.findByEmailWithRelations(normalizedEmail);

    if (!user || !user.isActive) {
      logAuth("login:user-not-found-or-inactive", {
        email: normalizedEmail,
        found: Boolean(user),
        isActive: user?.isActive || false,
      });
      throw new AppError("Invalid credentials", 401);
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      logAuth("login:password-mismatch", {
        email: normalizedEmail,
        userId: user.id,
      });
      throw new AppError("Invalid credentials", 401);
    }

    const personalId =
      user.role === "PERSONAL"
        ? user.personalProfile?.id || null
        : user.personalId || null;

    const token = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      personalId,
    });

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        personalId,
      },
    };
  }

  async register({ fullName, email, password, phone, personalId }) {
    if (!fullName || !email || !password || !personalId) {
      throw new AppError(
        "fullName, email, password and personalId are required",
        400,
      );
    }

    let resolvedPersonalId = String(personalId).trim();

    if (!isUuid(resolvedPersonalId)) {
      const tenant =
        await this.personalRepository.findTenantByIdentifier(
          resolvedPersonalId,
        );

      if (!tenant) {
        throw new AppError("Tenant not found for provided personalId", 400);
      }

      if (tenant.ambiguous) {
        throw new AppError(
          "Ambiguous tenant identifier. Use tenant UUID (personalId).",
          400,
        );
      }

      resolvedPersonalId = tenant.id;
    }

    const normalizedEmail = String(email || "").trim().toLowerCase();

    const existingUser = await this.userRepository.findByEmail(normalizedEmail);

    if (existingUser) {
      throw new AppError("Email already in use", 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await this.userRepository.create({
      email: normalizedEmail,
      passwordHash,
      role: "ALUNO",
      personalId: resolvedPersonalId,
      alunoProfile: {
        create: {
          fullName,
          email: normalizedEmail,
          phone: phone || null,
          personalId: resolvedPersonalId,
        },
      },
    });

    return this.login({ email: user.email, password });
  }

  async me(authContext) {
    if (!authContext?.userId) {
      throw new AppError("Unauthorized", 401);
    }

    const user = await this.userRepository.findByIdWithRelations(
      authContext.userId,
    );

    if (!user || !user.isActive) {
      throw new AppError("User not found", 404);
    }

    const personalId =
      user.role === "PERSONAL"
        ? user.personalProfile?.id || null
        : user.personalId || null;

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        personalId,
      },
      profile: user.alunoProfile || user.personalProfile || null,
    };
  }
}

module.exports = { AuthService };
