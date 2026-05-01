import { EXCEPTION_CODES } from "#constants/exceptionCodes.constants.js";
import { User } from "#models/user.model.js";
import { ErrorHandler } from "#utils/errorHandler.util.js";
import { uploadIcon } from "../lib/cloudinary.lib.js";

//#region GET services
const getMyDetails = async ({ userId }) => {
  const { _id, email, name, icon } = await User.findOne({
    _id: userId,
    isDeleted: false,
  }).lean();

  return { id: _id, email, name, iconUrl: icon.url };
};

const getProfileDetails = async ({ userId, isOwnProfile = false }) => {
  const user = await User.findOne({
    _id: userId,
    isDeleted: false,
  }).lean();

  if (!user) {
    throw new ErrorHandler(
      "User not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  return {
    id: user._id,
    name: user.name,
    iconUrl: user.icon.url,
    bio: user.bio,
    ...(isOwnProfile
      ? {
          username: user.username,
          email: user.email,
          isEmailVerified: user.isEmailVerified,
          createdAt: user.createdAt,
        }
      : {}),
  };
};

//#endregion

//#region UPDATE services
const updateProfile = async (userId, updatedDetails) => {
  const { name, bio } = updatedDetails;
  const user = await User.findOneAndUpdate(
    { _id: userId, isDeleted: false },
    { bio, name },
    { new: true },
  );
};

const updateUserAvatar = async (userId, avatar) => {
  if (!avatar)
    throw new ErrorHandler(
      "Missing field - file",
      EXCEPTION_CODES.MISSING_REQUIRED_FIELDS,
    );

  const user = await User.findById(userId);
  if (!user)
    throw new ErrorHandler(
      "User not found",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );

  const { url, publicId } = await uploadIcon(avatar.buffer, "user", {
    userId,
  });

  user.icon = { url, publicId };
  await user.save();
};
//#endregion

//#region Helper Services
const getUserWithLean = async (userId, errorMessage = null) => {
  const user = await User.findOne({
    _id: userId,
    isDeleted: false,
  }).lean();

  if (!user) {
    throw new ErrorHandler(
      errorMessage ?? "User not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  return user;
};

const changePassword = async ({ userId, currentPassword, newPassword }) => {
  const user = await User.findById(userId).select("+passwordHash");

  if (!user) {
    throw new ErrorHandler(
      "User not found",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // Verify current password
  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) {
    throw new ErrorHandler(
      "Current password is incorrect",
      EXCEPTION_CODES.INVALID_CREDENTIALS,
    );
  }

  // Validate new password is not the same as current
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

  await revokeAllActiveSessions(userId);
};

//#endregion

export const userService = {
  getUserWithLean,
  getMyDetails,
  getProfileDetails,
  updateProfile,
  updateUserAvatar,
  changePassword,
};
