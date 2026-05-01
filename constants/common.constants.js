// Organization
const ORG_INVITATION_EXPIRY_SECONDS = 7 * 24 * 60 * 60;

// Otp
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_MAX_FAILED_ATTEMPTS = 5;
const OTP_TTL_MINUTES = 10;
const OTP_LENGTH = 6;
const OTP_PURPOSES = Object.freeze({
  PasswordReset: "PasswordReset",
  EmailVerification: "EmailVerification",
});
const OTP_PURPOSES_VALUES = Object.values(OTP_PURPOSES);

// Outbox Messages
const OUTBOX_CONFIG = {
  MAX_RETRIES: 5,
  POLL_INTERVAL_MS: 15000,
};

export {
  ORG_INVITATION_EXPIRY_SECONDS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_MINUTES,
  OTP_LENGTH,
  OTP_PURPOSES,
  OTP_PURPOSES_VALUES,
  OUTBOX_CONFIG,
  OTP_MAX_FAILED_ATTEMPTS,
};
