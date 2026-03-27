import crypto from "crypto";
import jwt from "jsonwebtoken";
import { UAParser } from "ua-parser-js";
import env from "../configs/env.config.js";
import {
  ACCESS_TOKEN_EXPIRY_SECONDS,
  REFRESH_TOKEN_EXPIRY_SECONDS,
} from "../constants/token.constants.js";

const generateAccessToken = (userId) => {
  return jwt.sign({ sub: userId.toString() }, env.JWT_SECRET_KEY, {
    expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
  });
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, env.JWT_SECRET_KEY);
};

const generateInvitationToken = () => {
  return crypto.randomBytes(32).toString("hex"); // 64-char hex string
};

const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString("hex"); // 128-char hex string
};

//SHA-256 is fine here — tokens are already high-entropy randoms, so bcrypt's slowness is unnecessary (unlike passwords).
const hashToken = (rawToken) => {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
};

const setTokenCookies = (res, { accessToken, refreshToken }) => {
  const baseCookieOptions = {
    httpOnly: true,
    secure: env.ENVIRONMENT === "production",
    sameSite: "strict",
  };

  res.cookie("accessToken", accessToken, {
    ...baseCookieOptions,
    maxAge: ACCESS_TOKEN_EXPIRY_SECONDS * 1000,
  });

  res.cookie("refreshToken", refreshToken, {
    ...baseCookieOptions,
    maxAge: REFRESH_TOKEN_EXPIRY_SECONDS * 1000,
    path: "/api/v1/auth",
  });
};

const clearTokenCookies = (res) => {
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken", { path: "/api/v1/auth" });
};

// truncate UA as Real User-Agent strings are typically < 200–300 chars, no need to pass full UA to ua-parser-js
const MAX_UA_LENGTH = 500;

const extractDeviceInfo = (req) => {
  const rawUa = (req.headers["user-agent"] || "").substring(0, MAX_UA_LENGTH);
  const parser = new UAParser(rawUa);
  const result = parser.getResult();

  // ua-parser-js returns undefined for unrecognised fields — normalise to null
  const browser = result.browser.name ?? null;
  const operatingSystem = result.os.name ?? null;

  // undefined means desktop (ua-parser-js convention)
  const rawDeviceType = result.device.type;
  let device = "Desktop";
  if (rawDeviceType === "mobile") device = "Mobile";
  else if (rawDeviceType === "tablet") device = "Tablet";
  else if (rawDeviceType !== undefined) device = rawDeviceType; // console, smarttv, etc.

  // IP — respect reverse proxy headers
  const ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    null;

  return { device, browser, operatingSystem, ipAddress };
};

export {
  clearTokenCookies,
  extractDeviceInfo,
  generateAccessToken,
  generateInvitationToken,
  generateRefreshToken,
  hashToken,
  setTokenCookies,
  verifyAccessToken,
};
