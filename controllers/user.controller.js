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

  return sendResponse(res, 200, null, "User Details fetched successfully", {
    userDetails,
  });
});

const updateProfile = TryCatch(async (req, res, next) => {
  const updatedDetails = req.body;
  const result = await userService.updateProfile(req.userId, updatedDetails);

  sendResponse(res, 200, null, "Profile updated successfully.", result);
});

export { getMyDetails, getMyProfile, getUserProfile, updateProfile };
