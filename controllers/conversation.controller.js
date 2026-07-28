import { conversationService } from "#services/conversation.service.js";
import { TryCatch } from "#utils/errorHandler.util.js";
import { sendResponse } from "#utils/sendResponse.util.js";

//#region GET controllers
const getConversations = TryCatch(async (req, res) => {
  const result = await conversationService.getConversations({
    userId: req.userId,
    query: req.query,
  });

  return sendResponse(
    res,
    200,
    null,
    "Conversations fetched successfully.",
    result,
  );
});

const lookupDirectConversation = TryCatch(async (req, res) => {
  const { userId: targetUserId } = req.query;

  const result = await conversationService.lookupDirectConversation({
    userId: req.userId,
    targetUserId,
  });

  return sendResponse(
    res,
    200,
    null,
    "Direct conversation lookup successful.",
    result,
  );
});

const getConversation = TryCatch(async (req, res) => {
  const { conversationId } = req.context;

  const result = await conversationService.getConversation({
    conversationId,
    userId: req.userId,
  });

  return sendResponse(
    res,
    200,
    null,
    "Conversation fetched successfully.",
    result,
  );
});

const getParticipants = TryCatch(async (req, res) => {
  const { conversationId } = req.context;

  const result = await conversationService.getParticipants({
    conversationId,
    userId: req.userId,
    query: req.query,
  });

  return sendResponse(
    res,
    200,
    null,
    "Participants fetched successfully.",
    result,
  );
});

//#endregion

//#region UPDATE controllers
const createDirectConversation = TryCatch(async (req, res) => {
  const { targetUserId } = req.body;

  const result = await conversationService.createDirectConversation({
    userId: req.userId,
    targetUserId,
  });

  return sendResponse(
    res,
    200,
    null,
    "Direct conversation created successfully.",
    result,
  );
});

const createGroupConversation = TryCatch(async (req, res) => {
  const { name, participantUserIds } = req.body;

  const result = await conversationService.createGroupConversation({
    userId: req.userId,
    name,
    participantUserIds,
  });

  return sendResponse(
    res,
    200,
    null,
    "Group conversation created successfully.",
    result,
  );
});

const updateGroupConversationLogo = TryCatch(async (req, res) => {
  const { conversationId } = req.context;
  const logo = req.file;

  await conversationService.updateGroupConversationLogo({
    conversationId,
    userId: req.userId,
    logo,
  });

  return sendResponse(
    res,
    200,
    null,
    "Group conversation logo updated successfully.",
  );
});

const updateGroupConversation = TryCatch(async (req, res) => {
  const { conversationId } = req.context;
  const { name } = req.body;

  await conversationService.updateGroupConversation({
    conversationId,
    userId: req.userId,
    name,
  });

  return sendResponse(res, 200, null, "Conversation updated successfully.");
});

const removeGroupConversationLogo = TryCatch(async (req, res) => {
  const { conversationId } = req.context;

  await conversationService.removeGroupConversationLogo({
    conversationId,
    userId: req.userId,
  });

  return sendResponse(
    res,
    200,
    null,
    "Group conversation logo removed successfully.",
  );
});

const addParticipant = TryCatch(async (req, res) => {
  const { conversationId } = req.context;
  const { userId: targetUserId } = req.body;

  await conversationService.addParticipant({
    conversationId,
    userId: req.userId,
    targetUserId,
  });

  return sendResponse(res, 200, null, "Participant added successfully.");
});

const updateParticipantRole = TryCatch(async (req, res) => {
  const { conversationId } = req.context;
  const { role } = req.body;
  const { participantId } = req.params;

  await conversationService.updateParticipantRole({
    conversationId,
    participantId,
    userId: req.userId,
    role,
  });

  return sendResponse(res, 200, null, "Participant role updated successfully.");
});

const leaveConversation = TryCatch(async (req, res) => {
  const { conversationId } = req.context;

  await conversationService.leaveConversation({
    conversationId,
    userId: req.userId,
  });

  return sendResponse(res, 200, null, "Left conversation successfully.");
});

const removeParticipant = TryCatch(async (req, res) => {
  const { conversationId } = req.context;
  const { participantId } = req.params;

  await conversationService.removeParticipant({
    conversationId,
    participantId,
    userId: req.userId,
  });

  return sendResponse(res, 200, null, "Participant removed successfully.");
});

//#endregion

export {
  addParticipant,
  createDirectConversation,
  createGroupConversation,
  getConversation,
  getConversations,
  getParticipants,
  leaveConversation,
  lookupDirectConversation,
  removeGroupConversationLogo,
  removeParticipant,
  updateGroupConversation,
  updateGroupConversationLogo,
  updateParticipantRole,
};
