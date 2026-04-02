import express from "express";
import userRoute from "./user.routes.js";
import chatRoute from "./chat.routes.js";
import authRoute from "./auth.routes.js";
import organizationRoute from "./organization.routes.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.send("Home Page");
});

router.use("/auth", authRoute);
router.use("/org", authenticate, organizationRoute);
router.use("/user", userRoute);
// router.use("/chat", chatRoute);

export default router;
