import { channelMessageService } from "#services/channelMessage.service.js";
import { TryCatch } from "#utils/errorHandler.util.js";
import { sendResponse } from "#utils/sendResponse.util.js";

//#region GET controllers
const getChannelMessages = TryCatch(async (req, res) => {
  const { orgId, teamId, channelId } = req.context;

  const result = await channelMessageService.getChannelMessages({
    orgId,
    teamId,
    channelId,
    userId: req.userId,
    query: req.query,
  });

  return sendResponse(res, 200, null, "Messages fetched successfully.", result);
});

//#endregion

//#region UPDATE controllers
const sendChannelMessage = TryCatch(async (req, res) => {
  const { orgId, teamId, channelId } = req.context;
  const { threadId } = req.params;
  const { clientMessageId, content, fileIds, mentionedUserIds } = req.body;

  const result = await channelMessageService.sendChannelMessage({
    orgId,
    teamId,
    channelId,
    userId: req.userId,
    clientMessageId,
    content,
    fileIds: fileIds ?? [],
    mentionedUserIds: mentionedUserIds ?? [],
    threadRootMessageId: threadId ?? null,
  });

  return sendResponse(res, 200, null, "Message sent successfully.", result);
});

const forceDeleteChannelMessage = TryCatch(async (req, res) => {
  const { channelId } = req.context;
  const { messageId } = req.params;

  await channelMessageService.forceDeleteChannelMessage({
    channelId,
    messageId,
    userId: req.userId,
  });

  return sendResponse(res, 204, null, "Message deleted successfully.");
});

const deleteOwnMessage = TryCatch(async (req, res) => {
  const { channelId } = req.context;
  const { messageId } = req.params;

  await channelMessageService.deleteOwnMessage({
    channelId,
    messageId,
    userId: req.userId,
  });

  return sendResponse(res, 204, null, "Message deleted successfully.");
});

const pinChannelMessage = TryCatch(async (req, res) => {
  const { channelId } = req.context;
  const { messageId } = req.params;

  const result = await channelMessageService.pinChannelMessage({
    channelId,
    messageId,
    userId: req.userId,
  });

  return sendResponse(res, 200, null, "Message pinned successfully.", result);
});

const toggleChannelMessageReaction = TryCatch(async (req, res) => {
  const { channelId } = req.context;
  const { messageId } = req.params;
  const { emoji } = req.body;

  const result = await channelMessageService.toggleChannelMessageReaction({
    channelId,
    messageId,
    userId: req.userId,
    emoji,
  });

  return sendResponse(res, 200, null, "Reaction toggled successfully.", result);
});

const editChannelMessage = TryCatch(async (req, res) => {
  const { channelId } = req.context;
  const { messageId } = req.params;
  const { content, fileIds, mentionedUserIds } = req.body;

  const result = await channelMessageService.editChannelMessage({
    channelId,
    messageId,
    userId: req.userId,
    content,
    fileIds,
    mentionedUserIds,
  });

  return sendResponse(res, 200, null, "Message edited successfully.", result);
});

const uploadChannelAttachment = TryCatch(async (req, res) => {
  const { orgId, teamId, channelId } = req.context;

  const result = await channelMessageService.uploadChannelAttachment({
    orgId,
    teamId,
    channelId,
    userId: req.userId,
    file: req.file,
  });

  return sendResponse(
    res,
    200,
    null,
    "Attachment uploaded successfully.",
    result,
  );
});

//#endregion

export {
  getChannelMessages,
  sendChannelMessage,
  forceDeleteChannelMessage,
  deleteOwnMessage,
  pinChannelMessage,
  toggleChannelMessageReaction,
  editChannelMessage,
  uploadChannelAttachment,
};
