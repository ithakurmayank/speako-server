import bcrypt from "bcrypt";
import dayjs from "dayjs";
import { REFRESH_TOKEN_EXPIRY_SECONDS } from "../constants/token.constants.js";
import { TryCatch } from "../middlewares/error.middleware.js";
import { RefreshToken } from "../models/refreshToken.model.js";
import { User } from "../models/user.model.js";
import { ErrorHandler } from "../utils/errorHandler.util.js";
import { sendResponse } from "../utils/sendResponse.util.js";
import {
  clearTokenCookies,
  extractDeviceInfo,
  generateRefreshToken,
  hashRefreshToken,
  setTokenCookies,
  generateAccessToken,
} from "../utils/token.util.js";
import { EXCEPTION_CODES } from "../constants/exceptionCodes.constants.js";

const login = TryCatch(async (req, res, next) => {
  const { username, password } = req.body;
  console.log("username", username, password);

  const user = await User.findOne({
    username: username.toLowerCase().trim(),
  }).select("+passwordHash");

  if (!user || user.isDeleted) {
    throw new ErrorHandler(
      "Invalid credentials.",
      EXCEPTION_CODES.INVALID_CREDENTIALS,
    );
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    throw new ErrorHandler(
      "Invalid credentials.",
      EXCEPTION_CODES.INVALID_CREDENTIALS,
    );
  }

  const accessToken = generateAccessToken(user._id);
  const rawRefreshToken = generateRefreshToken();
  const hashedToken = hashRefreshToken(rawRefreshToken);
  const expiresAt = dayjs()
    .add(REFRESH_TOKEN_EXPIRY_SECONDS, "second")
    .toDate();
  const deviceInfo = extractDeviceInfo(req);

  await RefreshToken.create({
    userId: user._id,
    tokenHash: hashedToken,
    expiresAt,
    ...deviceInfo,
  });

  setTokenCookies(res, { accessToken, refreshToken: rawRefreshToken });

  return sendResponse(res, 200, null, "Login successfull", {
    user: {
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
    },
  });
});

const refresh = TryCatch(async (req, res) => {
  const rawToken = req.cookies?.refreshToken;

  if (!rawToken) {
    throw new ErrorHandler("No refresh token.", EXCEPTION_CODES.TOKEN_EXPIRED);
  }

  const hashedToken = hashRefreshToken(rawToken);

  const tokenRecord = await RefreshToken.findOne({ tokenHash: hashedToken });

  if (!tokenRecord) {
    throw new ErrorHandler(
      "Invalid refresh token.",
      EXCEPTION_CODES.INVALID_TOKEN,
    );
  }

  if (tokenRecord.isRevoked) {
    // ── Future feature: breach detected — revoke all sessions for this user ──────────
    // await RefreshToken.updateMany(
    //   { userId: tokenRecord.userId },
    //   { isRevoked: true, revokedAt: new Date() }
    // );
    // clearTokenCookies(res);
    throw new ErrorHandler(
      "Refresh token has been revoked.",
      EXCEPTION_CODES.REVOKED_REFRESH_TOKEN,
    );
  }

  if (tokenRecord.expiresAt < new Date()) {
    throw new ErrorHandler(
      "Refresh token expired. Please log in again.",
      EXCEPTION_CODES.TOKEN_EXPIRED,
    );
  }

  const newAccessToken = generateAccessToken(tokenRecord.userId);
  const newRawRefreshToken = generateRefreshToken();
  const newHashedToken = hashRefreshToken(newRawRefreshToken);
  const newExpiresAt = dayjs()
    .add(REFRESH_TOKEN_EXPIRY_SECONDS, "second")
    .toDate();
  const deviceInfo = extractDeviceInfo(req);

  // Update the existing record (never deletes — permanent audit trail)
  await RefreshToken.findByIdAndUpdate(tokenRecord._id, {
    tokenHash: newHashedToken,
    expiresAt: newExpiresAt,
    ...deviceInfo,
  });

  setTokenCookies(res, {
    accessToken: newAccessToken,
    refreshToken: newRawRefreshToken,
  });

  return sendResponse(res, 200, null, "Token refreshed.");
});

const logout = TryCatch(async (req, res) => {
  const rawToken = req.cookies?.refreshToken;

  if (rawToken) {
    const hashedToken = hashRefreshToken(rawToken);

    // Soft-revoke — never delete
    await RefreshToken.findOneAndUpdate(
      { tokenHash: hashedToken },
      { isRevoked: true, revokedAt: new Date() },
    );
  }

  clearTokenCookies(res);

  return sendResponse(res, 200, null, "Logged out successfully.");
});

export { login, logout, refresh };
