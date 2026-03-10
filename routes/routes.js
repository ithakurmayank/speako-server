import express from "express";
import userRoute from "./userRoute.js";
import chatRoute from "./chatRoute.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.send("Home Page");
});

router.use("/user", userRoute);
router.use("/chat", chatRoute);

export default router;
