import {
  getMyDetails,
  getMyProfile,
  getUserProfile,
  updateProfile,
} from "#controllers/user.controller.js";
import { authenticate } from "#middlewares/authenticate.middleware.js";
import { authorize } from "#middlewares/authorize.middleware.js";
import { validate } from "#middlewares/validator.middleware.js";
import { updateProfileSchema } from "#validators/user.validators.js";
import { Router } from "express";

const router = Router({ mergeParams: true });

router.use(authenticate);
router.get("/me", getMyDetails);
router.get("/profile/me", getMyProfile);
router.get("/profile/:id", getUserProfile);
router.put("/profile", validate(updateProfileSchema), updateProfile);
router.put("/profile", validate(updateProfileSchema), updateProfile);

export default router;
