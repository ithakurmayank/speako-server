import { PERMISSIONS } from "#constants/permissions.constants.js";
import {
  addParticipant,
  createDirectConversation,
  createGroupConversation,
  getConversation,
  getConversations,
  getParticipants,
  leaveConversation,
  lookupDirectConversation,
  removeParticipant,
  updateGroupConversation,
  updateGroupConversationLogo,
  updateParticipantRole,
} from "#controllers/conversation.controller.js";
import { authenticate } from "#middlewares/authenticate.middleware.js";
import { authorize } from "#middlewares/authorize.middleware.js";
import { validate } from "#middlewares/validator.middleware.js";
import {
  addParticipantSchema,
  createDirectConversationSchema,
  createGroupConversationSchema,
  getConversationsSchema,
  getParticipantsSchema,
  lookupDirectConversationSchema,
  updateGroupConversationSchema,
  updateParticipantRoleSchema,
} from "#validators/conversation.validators.js";
import { Router } from "express";

const router = Router({ mergeParams: true });
router.use(authenticate);

//#region GET routes
router.get("/", validate(getConversationsSchema), getConversations);

router.get(
  "/direct",
  validate(lookupDirectConversationSchema),
  lookupDirectConversation,
);

router.get("/:conversationId", getConversation);

router.get(
  "/:conversationId/participants",
  validate(getParticipantsSchema),
  getParticipants,
);

//#endregion

//#region UPDATE routes
router.post(
  "/direct",
  validate(createDirectConversationSchema),
  createDirectConversation,
);

router.post(
  "/group",
  validate(createGroupConversationSchema),
  createGroupConversation,
);

router.put(
  "/:conversationId/logo",
  authorize(PERMISSIONS.GROUP_SETTINGS_EDIT),
  updateGroupConversationLogo,
);

router.put(
  "/:conversationId",
  authorize(PERMISSIONS.GROUP_SETTINGS_EDIT),
  validate(updateGroupConversationSchema),
  updateGroupConversation,
);

router.delete(
  "/:conversationId/logo",
  authorize(PERMISSIONS.GROUP_SETTINGS_EDIT),
  validate(updateGroupConversationSchema),
  updateGroupConversation,
);

router.post(
  "/:conversationId/participants",
  authorize(PERMISSIONS.GROUP_MEMBERS_ADD),
  validate(addParticipantSchema),
  addParticipant,
);

router.put(
  "/:conversationId/participants/:participantId/role",
  authorize(PERMISSIONS.GROUP_MEMBERS_ROLE_CHANGE),
  validate(updateParticipantRoleSchema),
  updateParticipantRole,
);

router.delete("/:conversationId/participants/me", leaveConversation);

router.delete(
  "/:conversationId/participants/:participantId",
  authorize(PERMISSIONS.GROUP_MEMBERS_REMOVE),
  removeParticipant,
);

//#endregion

export default router;
