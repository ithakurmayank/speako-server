import { EXCEPTION_CODES } from "#constants/exceptionCodes.constants.js";
import { User } from "#models/user.model.js";
import { ErrorHandler } from "#utils/errorHandler.util.js";

const getMyDetails = async ({ userId }) => {
  const { _id, email, name, icon } = await User.findOne({
    _id: userId,
    isDeleted: false,
  }).lean();

  return { _id, email, name, avatar: icon.url };
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
    _id: user._id,
    name: user.name,
    avatar: user.icon.url,
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

const updateProfile = async (userId, updatedDetails) => {
  const { name, bio } = updatedDetails;
  const user = await User.findOneAndUpdate(
    { _id: userId, isDeleted: false },
    { bio, name },
    { new: true },
  );

  return { user };
};

// const updateProfile = async (userId, updatedDetails) => {
//   const { name, bio } = updatedDetails;
//   const user = await User.findOneAndUpdate(
//     { _id: userId, isDeleted: false },
//     { bio, name },
//     { new: true },
//   );

//   return {user};
// };

export const userService = {
  getMyDetails,
  getProfileDetails,
  updateProfile,
};
