import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import { login, logout, refresh } from "../controllers/auth.controller.js";
import { validate } from "../middlewares/validator.middleware.js";
import { loginSchema } from "../validators/auth.validators.js";

const router = Router();

router.post("/login", validate(loginSchema), login);

router.post("/refresh", refresh);

router.post("/logout", authenticate, logout);

export default router;
