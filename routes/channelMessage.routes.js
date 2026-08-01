import { PERMISSIONS } from "#constants/permissions.constants.js";
import {
  deleteOwnMessage,
  editChannelMessage,
  forceDeleteChannelMessage,
  getChannelMessages,
  pinChannelMessage,
  sendChannelMessage,
  toggleChannelMessageReaction,
  uploadChannelAttachment,
} from "#controllers/channelMessage.controller.js";
import { authenticate } from "#middlewares/authenticate.middleware.js";
import { authorize } from "#middlewares/authorize.middleware.js";
import { attachmentUploadMiddleware } from "#middlewares/multer.middleware.js";
import { validate } from "#middlewares/validator.middleware.js";
import {
  editMessageCommonSchema,
  getMessagesCommonSchema,
  sendMessageCommonSchema,
  toggleMessageReactionCommonSchema,
} from "#validators/message.validators.js";
import { Router } from "express";

const router = Router({ mergeParams: true });

//#region GET routes
router.get(
  "/",
  authorize(null),
  validate(getMessagesCommonSchema),
  getChannelMessages,
);

//#endregion

//#region UPDATE routes
router.post(
  "/",
  authorize(PERMISSIONS.MESSAGE_SEND),
  validate(sendMessageCommonSchema),
  sendChannelMessage,
);

router.post(
  "/:threadId/replies",
  authorize(PERMISSIONS.MESSAGE_THREAD_REPLY),
  validate(sendMessageCommonSchema),
  sendChannelMessage,
);

router.delete(
  "/messageId/force",
  authorize(PERMISSIONS.MESSAGE_DELETE_ANY),
  forceDeleteChannelMessage,
);

router.delete(
  "/messageId",
  authorize(PERMISSIONS.MESSAGE_DELETE_OWN),
  deleteOwnMessage,
);

router.post(
  "/messageId/pin",
  authorize(PERMISSIONS.MESSAGE_PIN),
  pinChannelMessage,
);

router.post(
  "/messageId/pin",
  authorize(PERMISSIONS.MESSAGE_PIN),
  pinChannelMessage,
);

router.post(
  "/messageId/reactions",
  authorize(PERMISSIONS.MESSAGE_REACT),
  validate(toggleMessageReactionCommonSchema),
  toggleChannelMessageReaction,
);

router.put(
  "/messageId",
  authorize(PERMISSIONS.MESSAGE_EDIT_OWN),
  validate(editMessageCommonSchema),
  editChannelMessage,
);

router.post(
  "/attachments",
  authorize(PERMISSIONS.MESSAGE_SEND),
  authorize(PERMISSIONS.MESSAGE_THREAD_REPLY),
  attachmentUploadMiddleware,
  uploadChannelAttachment,
);

//#endregion

export default router;
