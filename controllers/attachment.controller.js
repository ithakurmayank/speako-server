import { attachmentService } from "#services/attachment.service.js";
import { TryCatch } from "#utils/errorHandler.util.js";
import { sendResponse } from "#utils/sendResponse.util.js";

//#region GET controllers
//#endregion

//#region UPDATE controllers
const uploadChannelAttachment = TryCatch(async (req, res) => {
  const { orgId, teamId, channelId } = req.context;

  const result = await attachmentService.uploadChannelAttachment({
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

const uploadConversationAttachment = TryCatch(async (req, res) => {
  const { conversationId } = req.context;

  const result = await attachmentService.uploadConversationAttachment({
    conversationId,
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

export { uploadChannelAttachment, uploadConversationAttachment };
