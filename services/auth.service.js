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
import { MEMBER_SCOPES, USER_STATUS } from "constants/user.constants.js";
import { ALL_ROLES } from "constants/roles.constants.js";
import { Invitation } from "@models/invitation.model.js";
import mongoose from "mongoose";
import { Membership } from "@models/membership.model.js";
import { UserStatus } from "@models/userStatus.model.js";
import { Organization } from "@models/organization.model.js";

const loginUser = async ({ identifier, password, deviceInfo }) => {
  let query;

  if (isEmailValid(identifier)) {
    query = { email: identifier };
  } else {
    query = { username: identifier };
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
    user: {
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
    },
  };
};

const registerWithNewOrg = async (userDetails, deviceInfo) => {
  const { name, username, email, password, orgName, orgSlug } = userDetails;

  if (!orgSlugRegex.test(orgSlug)) {
    throw new ErrorHandler(
      "Organization slug can only contain lowercase letters, numbers, and hyphens.",
      EXCEPTION_CODES.VALIDATION_ERROR,
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await confirmUserDoesNotExist(email, username, session);

    const existingOrg = await Organization.findOne({ slug: orgSlug })
      .lean()
      .session(session);
    if (existingOrg) {
      throw new ErrorHandler(
        "Organization slug already taken.",
        EXCEPTION_CODES.DUPLICATE_RESOURCE,
      );
    }

    const user = await createUserAndStatus(
      { name, username, email, password },
      session,
    );

    const [org] = await Organization.create(
      [{ name: orgName, slug: orgSlug, createdBy: user._id }],
      { session },
    );

    await Membership.create(
      [
        {
          userId: user._id,
          orgId: org._id,
          scope: MEMBER_SCOPES.ORG,
          role: ALL_ROLES.OrgAdmin,
          joinedAt: new Date(),
        },
      ],
      { session },
    );

    const { accessToken, refreshToken } = await createTokens(
      user._id,
      deviceInfo,
      session,
    );

    await session.commitTransaction();

    return {
      accessToken,
      refreshToken,
      user: formatUser(user),
      org: {
        _id: org._id,
        name: org.name,
        slug: org.slug,
      },
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
    .populate("organizationId", "name slug")
    .lean();

  if (!invitation) {
    throw new ErrorHandler(
      "Invite link is invalid or has expired.",
      EXCEPTION_CODES.NOT_FOUND,
    );
  }

  // Invite was sent to a specific email — enforce it matches
  if (invitation.email !== email.toLowerCase()) {
    throw new ErrorHandler(
      "This invite was sent to a different email address.",
      EXCEPTION_CODES.FORBIDDEN,
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await confirmUserDoesNotExist(email, username, session);

    const user = await createUserAndStatus(
      { name, username, email, password },
      session,
    );

    await Membership.create(
      [
        {
          userId: user._id,
          organizationId: invitation.organizationId._id,
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

    await session.commitTransaction();

    return {
      accessToken,
      refreshToken,
      user: formatUser(user),
      org: {
        _id: invitation.organizationId._id,
        name: invitation.organizationId.name,
        slug: invitation.organizationId.slug,
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

//#region Internal Helpers

async function confirmUserDoesNotExist(email, username, session) {
  const existing = await User.findOne({
    $or: [{ email }, { username }],
  })
    .lean()
    .session(session);

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

function formatUser(user) {
  return {
    _id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
  };
}

//#endregion

export const authService = {
  loginUser,
  registerWithNewOrg,
  registerWithInvite,
  refreshToken,
  logoutUser,
};
