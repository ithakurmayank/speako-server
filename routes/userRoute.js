import express from "express";
import { registerUser } from "../controllers/userController.js";
import { singleAvatarUpload } from "../middlewares/multer.middleware.js";
import { isAuthenticated } from "../middlewares/auth.middleware.js";
import { validateHandler } from "../middlewares/validator.middleware.js";
import { registerValidator } from "../validators/auth.validators.js";

const router = express.Router();

router.post(
  "/register",
  singleAvatarUpload,
  registerValidator,
  validateHandler,
  registerUser,
);
// router.post("/login", loginValidator, validateHandler, login);

// // Protected routes
// router.use(isAuthenticated);
// router.get("/me", getMyProfile);
// router.get("/logout", logout);
// router.get("/search", searchUser);
// router.get("/notifications", getMyNotifications);
// router.get("/friends", getMyFriends);

// router.put(
//   "/sendrequest",
//   sendChatRequestValidator,
//   validateHandler,
//   sendChatRequest,
// );
// router.put(
//   "/acceptrequest",
//   acceptChatRequestValidator,
//   validateHandler,
//   acceptChatRequest,
// );

export default router;
