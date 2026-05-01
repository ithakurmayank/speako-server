import { authService } from "../services/auth.service.js";
import { TryCatch } from "../utils/errorHandler.util.js";
import { sendResponse } from "../utils/sendResponse.util.js";
import {
  clearTokenCookies,
  extractDeviceInfo,
  setTokenCookies,
} from "../utils/token.util.js";

const login = TryCatch(async (req, res, next) => {
  const { identifier, password } = req.body;

  const deviceInfo = extractDeviceInfo(req);

  const { accessToken, refreshToken } = await authService.loginUser({
    identifier,
    password,
    deviceInfo,
  });

  setTokenCookies(res, { accessToken, refreshToken });

  return sendResponse(res, 200, null, "Login successful");
});

const register = TryCatch(async (req, res, next) => {
  const { name, username, email, password, inviteToken } = req.body;

  const deviceInfo = extractDeviceInfo(req);

  if (inviteToken) {
  }

  const { accessToken, refreshToken } = inviteToken
    ? await authService.registerWithInvite(
        { name, username, email, password, inviteToken },
        deviceInfo,
      )
    : await authService.register(
        { name, username, email, password },
        deviceInfo,
      );

  setTokenCookies(res, { accessToken, refreshToken });

  return sendResponse(res, 201, null, "User registered successfully.");
});

const refresh = TryCatch(async (req, res) => {
  const rawToken = req.cookies?.refreshToken;

  const deviceInfo = extractDeviceInfo(req);

  const { accessToken, refreshToken } = await authService.refreshToken(
    rawToken,
    deviceInfo,
  );

  setTokenCookies(res, {
    accessToken,
    refreshToken,
  });

  return sendResponse(res, 200, null, "Token refreshed.");
});

const logout = TryCatch(async (req, res) => {
  const rawToken = req.cookies?.refreshToken;

  await authService.logoutUser(rawToken);

  clearTokenCookies(res);

  return sendResponse(res, 200, null, "Logged out successfully.");
});

const forgotPassword = TryCatch(async (req, res) => {
  const { email } = req.body;
  const { ipAddress } = extractDeviceInfo(req);

  await authService.forgotPassword(email, ipAddress);

  return sendResponse(
    res,
    200,
    null,
    "If that email is registered, you'll receive an OTP shortly.",
  );
});

const resetPassword = TryCatch(async (req, res) => {
  const { email, otp, newPassword } = req.body;

  await authService.resetPassword(email, otp, newPassword);

  return sendResponse(
    res,
    200,
    null,
    "Password reset successfully. Please log in with your new password.",
  );
});

const verifyUserEmail = TryCatch(async (req, res) => {
  const { otp } = req.body;

  await authService.verifyUserEmail({ userId: req.userId, otp });

  return sendResponse(res, 200, null, "Email verified successfully.");
});

const resendVerificationOtp = TryCatch(async (req, res) => {
  await authService.resendVerificationOtp({ userId: req.userId });

  return sendResponse(
    res,
    200,
    null,
    "If that email exists, you'll receive an OTP shortly.",
  );
});

export {
  login,
  logout,
  refresh,
  register,
  forgotPassword,
  resetPassword,
  verifyUserEmail,
  resendVerificationOtp,
};
