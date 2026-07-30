import { conversationMessageService } from "#services/conversationMessage.service.js";
import { TryCatch } from "#utils/errorHandler.util.js";
import { sendResponse } from "#utils/sendResponse.util.js";

//#region GET controllers
const getConversationMessages = TryCatch(async (req, res) => {
  const { conversationId } = req.context;

  const result = await conversationMessageService.getConversationMessages({
    conversationId,
    userId: req.userId,
    query: req.query,
  });

  return sendResponse(res, 200, null, "Messages fetched successfully.", result);
});
//#endregion

//#region UPDATE controllers
const sendConversationMessage = TryCatch(async (req, res) => {
  const { conversationId } = req.context;
  const {
    clientMessageId,
    content,
    fileIds,
    mentionedUserIds,
    threadRootMessageId,
  } = req.body;

  const result = await conversationMessageService.sendConversationMessage({
    conversationId,
    userId: req.userId,
    clientMessageId,
    content,
    fileIds,
    mentionedUserIds,
    threadRootMessageId,
  });

  return sendResponse(res, 201, null, "Message sent successfully.", result);
});

const forceDeleteConversationMessage = TryCatch(async (req, res) => {
  const { conversationId } = req.context;
  const { messageId } = req.params;

  await conversationMessageService.forceDeleteConversationMessage({
    conversationId,
    messageId,
    userId: req.userId,
  });

  return sendResponse(res, 204, null, "Message deleted successfully.");
});

const deleteOwnConversationMessage = TryCatch(async (req, res) => {
  const { conversationId } = req.context;
  const { messageId } = req.params;

  await conversationMessageService.deleteOwnConversationMessage({
    conversationId,
    messageId,
    userId: req.userId,
  });

  return sendResponse(res, 204, null, "Message deleted successfully.");
});

const pinConversationMessage = TryCatch(async (req, res) => {
  const { conversationId } = req.context;
  const { messageId } = req.params;

  const result = await conversationMessageService.pinConversationMessage({
    conversationId,
    messageId,
    userId: req.userId,
  });

  return sendResponse(res, 200, null, "Message pinned successfully.", result);
});

const toggleConversationMessageReaction = TryCatch(async (req, res) => {
  const { conversationId } = req.context;
  const { messageId } = req.params;
  const { emoji } = req.body;

  const result =
    await conversationMessageService.toggleConversationMessageReaction({
      conversationId,
      messageId,
      userId: req.userId,
      emoji,
    });

  return sendResponse(res, 200, null, "Reaction toggled successfully.", result);
});

const editConversationMessage = TryCatch(async (req, res) => {
  const { conversationId } = req.context;
  const { messageId } = req.params;
  const { content, fileIds, mentionedUserIds } = req.body;

  const result = await conversationMessageService.editConversationMessage({
    conversationId,
    messageId,
    userId: req.userId,
    content,
    fileIds,
    mentionedUserIds,
  });

  return sendResponse(res, 200, null, "Message edited successfully.", result);
});
//#endregion

export {
  deleteOwnConversationMessage,
  editConversationMessage,
  forceDeleteConversationMessage,
  getConversationMessages,
  pinConversationMessage,
  sendConversationMessage,
  toggleConversationMessageReaction,
};
