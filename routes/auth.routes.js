import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import {
  forgotPassword,
  login,
  logout,
  refresh,
  register,
  registerWithInvite,
  resetPassword,
} from "../controllers/auth.controller.js";
import { validate } from "../middlewares/validator.middleware.js";
import {
  loginSchema,
  registerWithInviteSchema,
  registerBaseSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validators/auth.validators.js";

const router = Router();

router.post("/login", validate(loginSchema), login);

router.post("/register", validate(registerBaseSchema), register);

router.post(
  "/register/:inviteToken",
  validate(registerWithInviteSchema),
  registerWithInvite,
);

router.post("/refresh", refresh);

router.post("/logout", authenticate, logout);

router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);

router.post("/reset-password", validate(resetPasswordSchema), resetPassword);

export default router;
