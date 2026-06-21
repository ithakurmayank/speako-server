import { PERMISSIONS } from "#constants/permissions.constants.js";
import {
  archiveChannel,
  createChannel,
  getChannel,
  getChannels,
  unarchiveChannel,
  updateChannel,
} from "#controllers/channel.controller.js";
import { authorize } from "#middlewares/authorize.middleware.js";
import { validate } from "#middlewares/validator.middleware.js";
import {
  createChannelSchema,
  updateChannelSchema,
} from "#validators/channel.validators.js";
import { Router } from "express";

const router = Router({ mergeParams: true });

//#region GET routes
router.get("/:channelId", getChannel);

router.get("/", getChannels);
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
//#endregion

export default router;
