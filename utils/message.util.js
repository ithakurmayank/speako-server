import { EXCEPTION_CODES } from "#constants/exceptionCodes.constants.js";
import { FILE_TYPES } from "#constants/fileTypes.constants.js";
import { MESSAGE_TYPES } from "#constants/message.constants.js";
import { ErrorHandler } from "./errorHandler.util.js";

const deriveMessageType = (content, fileTypes) => {
  const hasText = Boolean(content?.trim());

  if (hasText) {
    return MESSAGE_TYPES.TEXT;
  }

  if (fileTypes.length === 0) {
    throw new ErrorHandler(
      "Message must contain text or at least one attachment.",
      EXCEPTION_CODES.INVALID_FILE_TYPE,
    );
  }

  const allImages = fileTypes.every(
    (fileType) => fileType === FILE_TYPES.IMAGE,
  );

  return allImages ? MESSAGE_TYPES.IMAGE : MESSAGE_TYPES.FILE;
};

export { deriveMessageType };
