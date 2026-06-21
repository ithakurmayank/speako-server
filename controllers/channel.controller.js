import { channelService } from "#services/channel.service.js";
import { TryCatch } from "#utils/errorHandler.util.js";
import { sendResponse } from "#utils/sendResponse.util.js";

//#region GET controllers
const getChannel = TryCatch(async (req, res) => {
  const { orgId, teamId, channelId } = req.context;

  const result = await channelService.getChannel({
    orgId,
    teamId,
    channelId,
    userId: req.userId,
  });

  return sendResponse(res, 200, result, "Channel fetched successfully.");
});

const getChannels = TryCatch(async (req, res) => {
  const { orgId, teamId } = req.context;

  const result = await channelService.getChannels({
    orgId,
    teamId,
    userId: req.userId,
    query: req.query,
  });

  return sendResponse(res, 200, result, "Channels fetched successfully.");
});
//#endregion

//#region UPDATE controllers
const createChannel = TryCatch(async (req, res) => {
  const { orgId, teamId } = req.context;
  const { name, description, type, isPrivate } = req.body;

  await channelService.createChannel({
    orgId,
    teamId,
    userId: req.userId,
    name,
    description,
    type,
    isPrivate,
  });

  return sendResponse(res, 201, null, "Channel created successfully.");
});

const updateChannel = TryCatch(async (req, res) => {
  const { orgId, teamId, channelId } = req.context;
  const { name, description } = req.body;

  await channelService.updateChannel({
    orgId,
    teamId,
    channelId,
    userId: req.userId,
    name,
    description,
  });

  return sendResponse(res, 200, null, "Channel updated successfully.");
});

const archiveChannel = TryCatch(async (req, res) => {
  const { orgId, teamId, channelId } = req.context;

  await channelService.archiveChannel({
    orgId,
    teamId,
    channelId,
    userId: req.userId,
  });

  return sendResponse(res, 200, null, "Channel archived successfully.");
});

const unarchiveChannel = TryCatch(async (req, res) => {
  const { orgId, teamId, channelId } = req.context;

  await channelService.unarchiveChannel({
    orgId,
    teamId,
    channelId,
    userId: req.userId,
  });

  return sendResponse(res, 200, null, "Channel unarchived successfully.");
});

//#endregion

export {
  getChannel,
  createChannel,
  updateChannel,
  archiveChannel,
  unarchiveChannel,
  getChannels,
};
