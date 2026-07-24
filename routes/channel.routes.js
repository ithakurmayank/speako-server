import { PERMISSIONS } from "#constants/permissions.constants.js";
import {
  addChannelMember,
  archiveChannel,
  createChannel,
  getChannel,
  getChannels,
  leaveChannel,
  unarchiveChannel,
  updateChannel,
  updateChannelMemberRole,
} from "#controllers/channel.controller.js";
import { authorize } from "#middlewares/authorize.middleware.js";
import { validate } from "#middlewares/validator.middleware.js";
import {
  addChannelMemberSchema,
  createChannelSchema,
  getChannelsSchema,
  updateChannelMemberRoleSchema,
  updateChannelSchema,
} from "#validators/channel.validators.js";
import channelMessageRoute from "./channelMessage.routes.js";
import { Router } from "express";

const router = Router({ mergeParams: true });

//#region GET routes
router.get("/:channelId", validate(getChannelsSchema), getChannel);

router.get("/", getChannels);

router.get("/:channelId/members", getChannels);

//#endregion

//#region UPDATE routes
router.post(
  "/",
  authorize(PERMISSIONS.TEAM_CHANNELS_CREATE),
  validate(createChannelSchema),
  createChannel,
);

router.put(
  "/:channelId",
  authorize(PERMISSIONS.CHANNEL_SETTINGS_EDIT),
  validate(updateChannelSchema),
  updateChannel,
);

router.post(
  "/:channelId/archive",
  authorize(PERMISSIONS.TEAM_CHANNELS_ARCHIVE),
  archiveChannel,
);

router.post(
  "/:channelId/unarchive",
  authorize(PERMISSIONS.TEAM_CHANNELS_ARCHIVE),
  unarchiveChannel,
);

router.post(
  "/:channelId/members",
  authorize(PERMISSIONS.CHANNEL_MEMBERS_ADD),
  validate(addChannelMemberSchema),
  addChannelMember,
);

router.put(
  "/:channelId/members/:membershipId/role",
  authorize(PERMISSIONS.CHANNEL_MEMBERS_ROLE_CHANGE),
  validate(updateChannelMemberRoleSchema),
  updateChannelMemberRole,
);

router.delete("/:channelId/members/me", leaveChannel);

router.delete(
  "/:channelId/members/:membershipId",
  authorize(PERMISSIONS.CHANNEL_MEMBERS_REMOVE),
  leaveChannel,
);
//#endregion

//ChannelMessage Routes
router.use("/:channelId/messages", channelMessageRoute);

export default router;
