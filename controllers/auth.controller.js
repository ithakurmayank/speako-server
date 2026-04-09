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

  const { user, accessToken, refreshToken } = await authService.loginUser({
    identifier,
    password,
    deviceInfo,
  });

  setTokenCookies(res, { accessToken, refreshToken });

  return sendResponse(res, 200, null, "Login successful", {
    user,
  });
});

const register = TryCatch(async (req, res, next) => {
  const { name, username, email, password } = req.body;

  const deviceInfo = extractDeviceInfo(req);

  const { user, org, accessToken, refreshToken } = await authService.register(
    { name, username, email, password },
    deviceInfo,
  );

  setTokenCookies(res, { accessToken, refreshToken });

  return sendResponse(res, 201, null, "User registered successfully.", {
    user,
    org,
  });
});

const registerWithInvite = TryCatch(async (req, res, next) => {
  const { name, username, email, password } = req.body;
  const { inviteToken } = req.params;

  const deviceInfo = extractDeviceInfo(req);

  const { user, org, accessToken, refreshToken } =
    await authService.registerWithInvite(
      { name, username, email, password, inviteToken },
      deviceInfo,
    );

  setTokenCookies(res, { accessToken, refreshToken });

  return sendResponse(res, 201, null, "Joined organization successfully.", {
    user,
    org,
  });
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

export {
  login,
  logout,
  refresh,
  register,
  registerWithInvite,
  forgotPassword,
  resetPassword,
};
