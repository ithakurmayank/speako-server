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
  hashRefreshToken,
} from "../utils/token.util.js";
import { isEmailValid } from "../utils/regex.util.js";

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
  const hashedToken = hashRefreshToken(rawRefreshToken);
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

const registerUser = async (userDetails, deviceInfo) => {
  const { name, username, email, password } = userDetails;

  const existingUser = await User.findOne({
    $or: [{ email }, { username }],
  }).lean();

  if (existingUser) {
    throw new ErrorHandler(
      `${existingUser.username === username ? "Username" : "Email"} already exists.`,
      EXCEPTION_CODES.DUPLICATE_RESOURCE,
    );
  }

  const user = await User.create({
    name,
    username,
    email: email,
    passwordHash: password,
  });

  const accessToken = generateAccessToken(user._id);
  const rawRefreshToken = generateRefreshToken();
  const hashedToken = hashRefreshToken(rawRefreshToken);
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

export const authService = { loginUser, registerUser };
