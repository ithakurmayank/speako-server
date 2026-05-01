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
const ICON_MAX_SIZE_IN_MB = 5;
const ATTACHMENT_MAX_SIZE_IN_MB = 100;

const UPLOAD_TYPES = {
  ICON: "icon",
  ATTACHMENT: "attachment",
};

const UPLOAD_RULES = {
  [UPLOAD_TYPES.ICON]: {
    label: "Icon",
    maxSizeMB: ICON_MAX_SIZE_IN_MB,
  },
  [UPLOAD_TYPES.ATTACHMENT]: {
    label: "Attachment",
    maxSizeMB: ATTACHMENT_MAX_SIZE_IN_MB,
  },
};

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

const iconUpload = multer({
  storage,
  limits: { fileSize: ICON_MAX_SIZE_IN_MB * MB },
  fileFilter: makeFileFilter(ICON_MIME_TYPES),
});

const attachmentUpload = multer({
  storage,
  limits: { fileSize: ATTACHMENT_MAX_SIZE_IN_MB * MB },
  fileFilter: makeFileFilter(ATTACHMENT_MIME_TYPES),
});

// creates a middleware which attaches uploadType context to format error message in case of file limit size error
const createUploadMiddleware = ({
  upload,
  type,
  mode = "single", // "single" | "array" | "fields"
  field,
  maxCount, // only for array
  fieldsConfig, // only for fields
}) => {
  return (req, res, next) => {
    let middleware;

    if (mode === "single") {
      middleware = upload.single(field);
    } else if (mode === "array") {
      middleware = upload.array(field, maxCount);
    } else if (mode === "fields") {
      middleware = upload.fields(fieldsConfig);
    } else {
      return next(new Error("Invalid upload mode"));
    }

    // passed our own custom next() like: middleware(req,res,customNext())
    middleware(req, res, (err) => {
      if (err) {
        err.uploadType = type; // attach context
        return next(err);
      }
      next();
    });
  };
};

const iconUploadMiddleware = createUploadMiddleware({
  upload: iconUpload,
  type: UPLOAD_TYPES.ICON,
  mode: "single",
  field: "file",
});

const attachmentUploadMiddleware = createUploadMiddleware({
  upload: attachmentUpload,
  type: UPLOAD_TYPES.ATTACHMENT,
  mode: "array",
  field: "files",
  // maxCount: 10,
});

export { iconUploadMiddleware, attachmentUploadMiddleware, UPLOAD_RULES };
