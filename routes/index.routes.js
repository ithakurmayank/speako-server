import express from "express";
import userRoute from "./user.routes.js";
import conversationRoute from "./conversation.routes.js";
import authRoute from "./auth.routes.js";
import organizationRoute from "./organization.routes.js";
import notificationRoute from "./notification.routes.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.send("Home Page");
});

router.use("/auth", authRoute);
router.use("/orgs", organizationRoute);
router.use("/user", userRoute);
router.use("/conversations", conversationRoute);
router.use("/notifications", notificationRoute);

export default router;
