import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import {
  forgotPassword,
  login,
  logout,
  refresh,
  register,
  resetPassword,
  resendVerificationOtp,
  verifyUserEmail,
} from "../controllers/auth.controller.js";
import { validate } from "../middlewares/validator.middleware.js";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyUserEmailSchema,
} from "../validators/auth.validators.js";

const router = Router();

router.post("/login", validate(loginSchema), login);

router.post("/register", validate(registerSchema), register);

router.post("/refresh", refresh);

router.post("/logout", authenticate, logout);

router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);

router.post("/reset-password", validate(resetPasswordSchema), resetPassword);

router.post(
  "/verify-email",
  authenticate,
  validate(verifyUserEmailSchema),
  verifyUserEmail,
);

router.post("/resend-verification", authenticate, resendVerificationOtp);

export default router;
