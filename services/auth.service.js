//// @ts-nocheck
import bcrypt from "bcrypt";
import dayjs from "dayjs";
import { EXCEPTION_CODES } from "../constants/exceptionCodes.constants.js";
import { REFRESH_TOKEN_EXPIRY_SECONDS } from "../constants/token.constants.js";
import { RefreshToken } from "../models/refreshToken.model.js";
import { User } from "../models/user.model.js";
import { ErrorHandler } from "../utils/errorHandler.util.js";
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} from "../utils/token.util.js";
import { isEmailValid, orgSlugRegex } from "../utils/regex.util.js";
import { MEMBER_SCOPES, USER_STATUS } from "#constants/user.constants.js";
import { ALL_ROLES } from "#constants/roles.constants.js";
import { Invitation } from "#models/invitation.model.js";
import mongoose from "mongoose";
import { Membership } from "#models/membership.model.js";
import { UserStatus } from "#models/userStatus.model.js";
import { Organization } from "#models/organization.model.js";
import {
  OTP_MAX_FAILED_ATTEMPTS,
  OTP_PURPOSES,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_MINUTES,
} from "#constants/common.constants.js";
import {
  generateOtp,
  hashOtp,
  verifyRawOtpWithOtpHash,
} from "#utils/otp.util.js";
import { OtpVerification } from "#models/otpVerification.model.js";
import { outboxService } from "./outbox.service.js";
import {
  NOTIFICATION_TEMPLATE_NAMES,
  TEMPLATE_TYPES,
} from "#models/notificationTemplate.model.js";
import env from "../configs/env.config.js";
import { userService } from "./user.service.js";

//#region UPDATE services
const loginUser = async ({ identifier, password, deviceInfo }) => {
  let query;

  if (isEmailValid(identifier)) {
    query = { email: identifier, isDeleted: false };
  } else {
    query = { username: identifier, isDeleted: false };
  }

  const user = await User.findOne(query).select("+passwordHash");

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
  const hashedToken = hashToken(rawRefreshToken);
  const expiresAt = dayjs()
    .add(REFRESH_TOKEN_EXPIRY_SECONDS, "second")
    .toDate();

  await RefreshToken.create({
    userId: user._id,
    tokenHash: hashedToken,
    expiresAt,
    ...deviceInfo,
  });

  return {
    accessToken,
    refreshToken: rawRefreshToken,
  };
};

const register = async (userDetails, deviceInfo) => {
  const { name, username, email, password } = userDetails;

  await confirmUserDoesNotExist(email, username);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await createUserAndStatus(
      { name, username, email, password },
      session,
    );

    const { accessToken, refreshToken } = await createTokens(
      user._id,
      deviceInfo,
      session,
    );

    generateOtpAndQueueEmailAfterRegister(user);

    await session.commitTransaction();

    return {
      accessToken,
      refreshToken,
      user: formatUser(user),
    };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

const registerWithInvite = async (userDetails, deviceInfo) => {
  const { name, username, email, password, inviteToken } = userDetails;

  const invitation = await Invitation.findOne({
    token: hashToken(inviteToken),
    isUsed: false,
    expiresAt: { $gt: new Date() },
  })
    .populate("orgId", "name slug")
    .lean();

  if (!invitation) {
    throw new ErrorHandler(
      "Invite link is invalid or has expired.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // Invite was sent to a specific email — enforce it matches
  if (invitation.email !== email.toLowerCase()) {
    throw new ErrorHandler(
      "This invite was sent to a different email address.",
      EXCEPTION_CODES.FORBIDDEN,
    );
  }

  await confirmUserDoesNotExist(email, username);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await createUserAndStatus(
      { name, username, email, password },
      session,
    );

    await Membership.create(
      [
        {
          userId: user._id,
          orgId: invitation.orgId._id,
          scope: MEMBER_SCOPES.ORG,
          role: invitation.role,
          invitedBy: invitation.createdBy,
          joinedAt: new Date(),
        },
      ],
      { session },
    );

    await Invitation.findByIdAndUpdate(
      invitation._id,
      { isUsed: true, usedAt: new Date(), usedBy: user._id },
      { session },
    );

    const { accessToken, refreshToken } = await createTokens(
      user._id,
      deviceInfo,
      session,
    );

    generateOtpAndQueueEmailAfterRegister(user);
    await session.commitTransaction();

    return {
      accessToken,
      refreshToken,
      user: formatUser(user),
      org: {
        _id: invitation.orgId._id,
        name: invitation.orgId.name,
        slug: invitation.orgId.slug,
      },
    };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

const refreshToken = async (rawToken, deviceInfo) => {
  if (!rawToken) {
    throw new ErrorHandler("No refresh token.", EXCEPTION_CODES.TOKEN_EXPIRED);
  }

  const hashedToken = hashToken(rawToken);

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
    //   { userId: tokenRecord.userId, isRevoked: false },
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
  const newHashedToken = hashToken(newRawRefreshToken);
  const newExpiresAt = dayjs()
    .add(REFRESH_TOKEN_EXPIRY_SECONDS, "second")
    .toDate();

  // Update the existing record (never deletes — permanent audit trail)
  await RefreshToken.findByIdAndUpdate(tokenRecord._id, {
    tokenHash: newHashedToken,
    expiresAt: newExpiresAt,
    ...deviceInfo,
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRawRefreshToken,
  };
};

const logoutUser = async (rawToken) => {
  if (rawToken) {
    const hashedToken = hashToken(rawToken);

    // Soft-revoke — never delete
    await RefreshToken.findOneAndUpdate(
      { tokenHash: hashedToken },
      { isRevoked: true, revokedAt: new Date() },
    );
  }
};

const forgotPassword = async (email, ipAddress) => {
  const user = await User.findOne({
    email: email.toLowerCase().trim(),
    isDeleted: false,
  });

  if (!user) return;

  const rawOtp = await generateAndSaveOtp({
    userId: user._id,
    purpose: OTP_PURPOSES.PasswordReset,
  });

  if (!rawOtp) return;

  await outboxService.queueEmail(
    {
      to: "mt3197356@gmail.com", //delete/remove this when hosting,
      // to: user.email,
      templateName: NOTIFICATION_TEMPLATE_NAMES.PASSWORD_RESET_OTP_EMAIL,
      variables: {
        appName: env.APP_NAME,
        userName: user.name,
        otp: rawOtp,
        expiryMinutes: String(OTP_TTL_MINUTES),
        resetLink: `${env.FRONTEND_URL}/auth/reset-password`,
        year: dayjs().year(),
      },
    },
    user._id,
  );
};

const resetPassword = async (email, otp, newPassword) => {
  const user = await User.findOne({
    email: email.toLowerCase().trim(),
    isDeleted: false,
  }).select("+passwordHash");

  // Same generic error for user-not-found and bad-OTP so the caller
  // can't enumerate which emails are registered
  const genericError = new ErrorHandler(
    "Invalid or expired OTP.",
    EXCEPTION_CODES.INVALID_INPUT,
  );

  if (!user) {
    throw genericError;
  }

  const otpDoc = await OtpVerification.findOne({
    userId: user._id,
    purpose: OTP_PURPOSES.PasswordReset,
    isUsed: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!otpDoc) {
    throw genericError;
  }

  const isMatch = await verifyRawOtpWithOtpHash(otp, otpDoc.otpHash);

  if (!isMatch) {
    otpDoc.failedAttempts += 1;

    if (otpDoc.failedAttempts >= OTP_MAX_FAILED_ATTEMPTS) {
      otpDoc.isUsed = true;
      otpDoc.usedAt = new Date();
      await otpDoc.save();
      throw genericError;
    }

    await otpDoc.save();
    throw genericError;
  }

  otpDoc.isUsed = true;
  otpDoc.usedAt = new Date();
  await otpDoc.save();

  const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
  if (isSamePassword) {
    throw new ErrorHandler(
      "New password must be different from your current password.",
      EXCEPTION_CODES.INVALID_INPUT,
    );
  }

  // pre save hook hashes the password, so pass raw password itself
  user.passwordHash = newPassword;
  await user.save();

  await revokeAllActiveSessions(user._id);
};

const verifyUserEmail = async ({ userId, otp }) => {
  const user = await userService.getUserWithLean(userId);

  if (user.isEmailVerified) {
    throw new ErrorHandler(
      "Email is already verified.",
      EXCEPTION_CODES.INVALID_INPUT,
    );
  }

  const otpDoc = await OtpVerification.findOne({
    userId,
    purpose: OTP_PURPOSES.EmailVerification,
    isUsed: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  const genericError = new ErrorHandler(
    "Invalid or expired OTP.",
    EXCEPTION_CODES.INVALID_INPUT,
  );

  if (!otpDoc) throw genericError;

  const isMatch = await verifyRawOtpWithOtpHash(otp, otpDoc.otpHash);

  if (!isMatch) {
    otpDoc.failedAttempts += 1;

    if (otpDoc.failedAttempts >= OTP_MAX_FAILED_ATTEMPTS) {
      otpDoc.isUsed = true;
      otpDoc.usedAt = new Date();
      await otpDoc.save();
      throw genericError;
    }

    await otpDoc.save();
    throw genericError;
  }

  otpDoc.isUsed = true;
  otpDoc.usedAt = new Date();

  await Promise.all([
    otpDoc.save(),
    User.updateOne({ _id: userId }, { $set: { isEmailVerified: true } }),
  ]);
};

const resendVerificationOtp = async ({ userId }) => {
  const user = await userService.getUserWithLean(userId);
  // Silent return — don't reveal whether email is already verified
  if (user.isEmailVerified) return;

  generateOtpAndQueueEmailAfterRegister(user);
};

//#endregion

export const authService = {
  loginUser,
  register,
  registerWithInvite,
  refreshToken,
  logoutUser,
  forgotPassword,
  resetPassword,
  verifyUserEmail,
  resendVerificationOtp,
};

//#region Internal Helpers

async function confirmUserDoesNotExist(email, username) {
  const existing = await User.findOne({
    $or: [{ email }, { username }],
  }).lean();

  if (!existing) return;

  throw new ErrorHandler(
    existing.username === username
      ? "Username already exists."
      : "Email already exists.",
    EXCEPTION_CODES.DUPLICATE_RESOURCE,
  );
}

async function createUserAndStatus(
  { name, username, email, password },
  session,
) {
  const [user] = await User.create(
    [{ name, username, email, passwordHash: password }],
    { session },
  );

  await UserStatus.create([{ userId: user._id, status: USER_STATUS.ONLINE }], {
    session,
  });

  return user;
}

async function createTokens(userId, deviceInfo, session) {
  const accessToken = generateAccessToken(userId);
  const rawRefreshToken = generateRefreshToken();
  const hashedToken = hashToken(rawRefreshToken);
  const expiresAt = dayjs()
    .add(REFRESH_TOKEN_EXPIRY_SECONDS, "second")
    .toDate();

  await RefreshToken.create(
    [
      {
        userId,
        tokenHash: hashedToken,
        expiresAt,
        ...deviceInfo,
      },
    ],
    { session },
  );

  return { accessToken, refreshToken: rawRefreshToken };
}

async function generateAndSaveOtp({ userId, purpose, ipAddress = null }) {
  const latestOtp = await OtpVerification.findOne({
    userId,
    purpose,
  })
    .sort({ createdAt: -1 })
    .lean();

  if (latestOtp) {
    const cooldownEndsAt = new Date(
      latestOtp.createdAt.getTime() + OTP_RESEND_COOLDOWN_SECONDS * 1000,
    );
    if (new Date() < cooldownEndsAt) {
      return null;
    }
  }

  // Invalidate all previous unused OTPs for given purpose
  await OtpVerification.updateMany(
    { userId, purpose, isUsed: false },
    { $set: { isUsed: true, usedAt: new Date() } },
  );

  const rawOtp = generateOtp();
  const otpHash = await hashOtp(rawOtp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await OtpVerification.create({
    userId,
    purpose,
    otpHash,
    ipAddress,
    expiresAt,
  });

  return rawOtp;
}

async function generateOtpAndQueueEmailAfterRegister(user) {
  const rawOtp = await generateAndSaveOtp({
    userId: user._id,
    purpose: OTP_PURPOSES.EmailVerification,
  });

  // Silent return — rate limit hit inside generateAndSaveOtp
  if (!rawOtp) return;

  await outboxService.queueEmail(
    {
      to: "mt3197356@gmail.com", //delete/remove this when hosting,
      // to: user.email,
      templateName: NOTIFICATION_TEMPLATE_NAMES.USER_EMAIL_VERIFICATION_EMAIL,
      variables: {
        appName: env.APP_NAME,
        userName: user.name,
        otp: rawOtp,
        expiryMinutes: String(OTP_TTL_MINUTES),
        verificationLink: `${env.FRONTEND_URL}/auth/verify-email`,
        year: dayjs().year(),
        privacyPolicy: `${env.FRONTEND_URL}/privacy`,
      },
    },
    user._id,
  );
}

// revoke all refresh tokens — force re-login on all devices
async function revokeAllActiveSessions(userId) {
  await RefreshToken.updateMany(
    { userId, isRevoked: false },
    { isRevoked: true, revokedAt: new Date() },
  );
}

function formatUser(user) {
  return {
    _id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
  };
}

//#endregion
