import {
  changePassword,
  getMyDetails,
  getMyProfile,
  getUserProfile,
  updateProfile,
  updateUserAvatar,
} from "#controllers/user.controller.js";
import { authenticate } from "#middlewares/authenticate.middleware.js";
import { authorize } from "#middlewares/authorize.middleware.js";
import { iconUploadMiddleware } from "#middlewares/multer.middleware.js";
import { validate } from "#middlewares/validator.middleware.js";
import { changePasswordSchema } from "#validators/auth.validators.js";
import { updateProfileSchema } from "#validators/user.validators.js";
import { Router } from "express";

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get("/me", getMyDetails);

router.get("/profile/me", getMyProfile);

router.get("/profile/:id", getUserProfile);

router.put("/me", validate(updateProfileSchema), updateProfile);

router.put("/me/avatar", iconUploadMiddleware, updateUserAvatar);

router.post(
  "me/change-password",
  authenticate,
  validate(changePasswordSchema),
  changePassword,
);

export default router;
