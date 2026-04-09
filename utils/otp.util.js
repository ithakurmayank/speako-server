import { OTP_LENGTH } from "#constants/common.constants.js";
import crypto from "crypto";
import bcrypt from "bcrypt";

/**
 * Generate a cryptographically random numeric OTP.
 * crypto.randomInt is uniform and unbiased unlike Math.random().
 * Returns a zero-padded string, e.g. "048291"
 */
function generateOtp() {
  const max = Math.pow(10, OTP_LENGTH); // 1_000_000 for 6 digits
  const raw = crypto.randomInt(0, max);
  return raw.toString().padStart(OTP_LENGTH, "0");
}

async function hashOtp(otp) {
  return bcrypt.hash(otp, 10);
}

async function verifyOtpHash(rawOtp, storedHash) {
  return bcrypt.compare(rawOtp, storedHash);
}

export { generateOtp, hashOtp, verifyOtpHash };
