import { userService } from "#services/user.service.js";
import { TryCatch } from "#utils/errorHandler.util.js";
import { sendResponse } from "#utils/sendResponse.util.js";

const getMyDetails = TryCatch(async (req, res, next) => {
  const userDetails = await userService.getMyDetails({
    userId: req.userId,
  });

  return sendResponse(res, 200, null, "User Details fetched successfully", {
    userDetails,
  });
});

const getMyProfile = TryCatch(async (req, res, next) => {
  const userDetails = await userService.getProfileDetails({
    userId: req.userId,
    isOwnProfile: true,
  });

  return sendResponse(res, 200, null, "User Details fetched successfully", {
    userDetails,
  });
});

const getUserProfile = TryCatch(async (req, res, next) => {
  const userId = req.params.id;
  const userDetails = await userService.getProfileDetails({
    userId,
    isOwnProfile: false,
  });

  return sendResponse(res, 200, null, "User details fetched successfully", {
    userDetails,
  });
});

const updateProfile = TryCatch(async (req, res, next) => {
  const updatedDetails = req.body;
  await userService.updateProfile(req.userId, updatedDetails);

  sendResponse(res, 200, null, "Profile updated successfully.");
});

const updateUserAvatar = TryCatch(async (req, res, next) => {
  const avatar = req.file;
  await userService.updateUserAvatar(req.userId, avatar);

  sendResponse(res, 200, null, "User icon updated.");
});

const changePassword = TryCatch(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  await authService.changePassword({
    userId: req.userId,
    currentPassword,
    newPassword,
  });

  return sendResponse(
    res,
    200,
    null,
    "Password reset successfully. Please log in with your new password.",
  );
});

export {
  getMyDetails,
  getMyProfile,
  getUserProfile,
  updateProfile,
  updateUserAvatar,
  changePassword,
};
