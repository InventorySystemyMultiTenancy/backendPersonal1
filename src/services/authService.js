const bcrypt = require("bcryptjs");
const { AppError } = require("../utils/appError");
const { signAccessToken } = require("../utils/jwt");

class AuthService {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async login({ email, password }) {
    const user = await this.userRepository.findByEmailWithRelations(email);

    if (!user || !user.isActive) {
      throw new AppError("Invalid credentials", 401);
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
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

    const existingUser = await this.userRepository.findByEmail(email);

    if (existingUser) {
      throw new AppError("Email already in use", 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await this.userRepository.create({
      email,
      passwordHash,
      role: "ALUNO",
      personalId,
      alunoProfile: {
        create: {
          fullName,
          email,
          phone: phone || null,
          personalId,
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
