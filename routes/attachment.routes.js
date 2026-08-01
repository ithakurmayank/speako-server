import { PERMISSIONS } from "#constants/permissions.constants.js";
import {
  uploadChannelAttachment,
  uploadConversationAttachment,
} from "#controllers/attachment.controller.js";
import { authorize } from "#middlewares/authorize.middleware.js";
import { attachmentUploadMiddleware } from "#middlewares/multer.middleware.js";
import { Router } from "express";

const router = Router({ mergeParams: true });

//#region GET routes
//#endregion

//#region UPDATE routes
router.post(
  "/", //TODO:Path not decided
  authorize(PERMISSIONS.MESSAGE_SEND),
  authorize(PERMISSIONS.MESSAGE_THREAD_REPLY),
  attachmentUploadMiddleware,
  uploadChannelAttachment,
);

router.post(
  "/", //TODO:Path not decided
  authorize(PERMISSIONS.MESSAGE_SEND),
  authorize(PERMISSIONS.MESSAGE_THREAD_REPLY),
  attachmentUploadMiddleware,
  uploadConversationAttachment,
);
//#endregion

export default router;
