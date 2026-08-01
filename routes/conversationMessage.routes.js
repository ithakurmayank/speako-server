import { PERMISSIONS } from "#constants/permissions.constants.js";
import {
  deleteOwnConversationMessage,
  editConversationMessage,
  forceDeleteConversationMessage,
  getConversationMessages,
  pinConversationMessage,
  sendConversationMessage,
  toggleConversationMessageReaction,
  uploadConversationAttachment,
} from "#controllers/conversationMessage.controller.js";
import { authorize } from "#middlewares/authorize.middleware.js";
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
  getConversationMessages,
);

//#endregion

//#region UPDATE routes
router.post(
  "/",
  authorize(PERMISSIONS.MESSAGE_SEND),
  validate(sendMessageCommonSchema),
  sendConversationMessage,
);

router.post(
  "/:threadId/replies",
  authorize(PERMISSIONS.MESSAGE_THREAD_REPLY),
  validate(sendMessageCommonSchema),
  sendConversationMessage,
);

router.delete(
  "/:messageId/force",
  authorize(PERMISSIONS.MESSAGE_DELETE_ANY),
  forceDeleteConversationMessage,
);

router.delete(
  "/:messageId",
  authorize(PERMISSIONS.MESSAGE_DELETE_OWN),
  deleteOwnConversationMessage,
);

router.post(
  "/:messageId/pin",
  authorize(PERMISSIONS.MESSAGE_PIN),
  pinConversationMessage,
);

router.post(
  "/:messageId/reactions",
  authorize(PERMISSIONS.MESSAGE_REACT),
  validate(toggleMessageReactionCommonSchema),
  toggleConversationMessageReaction,
);

router.put(
  "/:messageId",
  authorize(PERMISSIONS.MESSAGE_EDIT_OWN),
  validate(editMessageCommonSchema),
  editConversationMessage,
);

router.post(
  "/attachments",
  authorize(PERMISSIONS.MESSAGE_SEND),
  authorize(PERMISSIONS.MESSAGE_THREAD_REPLY),
  attachmentUploadMiddleware,
  uploadConversationAttachment,
);

//#endregion

export default router;
