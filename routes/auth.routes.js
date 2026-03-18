import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import { login, logout, refresh } from "../controllers/auth.controller.js";

const router = Router();

router.post("/login", login);

router.post("/refresh", refresh);

router.post("/logout", authenticate, logout);

export default router;
