import multer from "multer";
import { ErrorHandler } from "../utils/errorHandler.util.js";
import { EXCEPTION_CODES } from "../constants/exceptionCodes.constants.js";

const ICON_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const ATTACHMENT_MIME_TYPES = new Set([
  // Images
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/avif",
  // Video
  "video/mp4",
  "video/quicktime",
  "video/webm",
  // Audio
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/mp4",
  "audio/aac",
  "audio/x-m4a",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // Code / text
  "text/plain",
  "text/javascript",
  "application/javascript",
  "text/typescript",
  "text/x-python",
  "text/html",
  "text/css",
  "application/json",
  // Archives
  "application/zip",
  "application/x-rar-compressed",
  "application/gzip",
  "application/x-7z-compressed",
]);

const MB = 1024 * 1024;
const ICON_MAX_SIZE = 5 * MB;
const ATTACHMENT_MAX_SIZE = 100 * MB;

const storage = multer.memoryStorage();

const makeFileFilter = (allowedTypes) => (_req, file, cb) => {
  if (allowedTypes.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new ErrorHandler(
        `File type "${file.mimetype}" is not allowed.`,
        EXCEPTION_CODES.INVALID_FILE_TYPE,
      ),
      false,
    );
  }
};

export const iconUpload = multer({
  storage,
  limits: { fileSize: ICON_MAX_SIZE },
  fileFilter: makeFileFilter(ICON_MIME_TYPES),
});

export const attachmentUpload = multer({
  storage,
  limits: { fileSize: ATTACHMENT_MAX_SIZE },
  fileFilter: makeFileFilter(ATTACHMENT_MIME_TYPES),
});
