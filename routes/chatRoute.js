import express from "express";
import { isAuthenticated } from "../middlewares/auth.middleware.js";
import { attachmentsUpload } from "../middlewares/multer.middleware.js";

const router = express.Router();

// router.use(isAuthenticated);
// // Protected routes
// router.post("/new", newGroupValidator, validateHandler, newGroupChat);
// router.post("/addmembers", addMemberValidator, validateHandler, addMembers);
// router.post(
//   "/message",
//   sendAttachmentsValidator,
//   validateHandler,
//   attachmentsUpload,
//   sendAttachments,
// );
// router.put(
//   "/removemember",
//   removeMemberValidator,
//   validateHandler,
//   removeMember,
// );
// router.put("/leavegroup/:id", leaveGroup);
// router.get("/my", getMyChats);
// router.get("/my/groups", getMyGroups);

// // Get Messages
// router.get("/message/:id", getMessages);

// router
//   .route("/:id")
//   .get(chatIdValidator, validateHandler, getChatDetails)
//   .put(renameValidator, validateHandler, renameGroup)
//   .delete(chatIdValidator, validateHandler, deleteChat);

export default router;
