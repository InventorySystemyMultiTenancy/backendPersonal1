const bcrypt = require("bcryptjs");
const { AppError } = require("../utils/appError");
const { signAccessToken } = require("../utils/jwt");

class AuthService {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async login({ email, password }) {
    const user = await this.userRepository.findByEmail(email);

    if (!user || !user.isActive) {
      throw new AppError("Invalid credentials", 401);
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      throw new AppError("Invalid credentials", 401);
    }

    const token = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      personalId: user.personalId || null,
    });

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        personalId: user.personalId || null,
      },
    };
  }
}

module.exports = { AuthService };
