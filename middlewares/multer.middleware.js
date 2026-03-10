/**
 * Multer middleware configurations
 *
 * All uploads use memoryStorage — the buffer is passed directly to Cloudinary
 * via upload_stream. Nothing is written to disk.
 *
 * Three configs:
 *   iconUpload        → single image, 5 MB max (avatars, org/team/group icons)
 *   attachmentUpload  → single file, 100 MB max, all allowed types
 *   multiAttachment   → up to 10 files, 100 MB each (future: multi-file messages)
 */

import multer from "multer";

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

// ─── File filter factories ────────────────────────────────────────────────────

const makeFileFilter = (allowedTypes) => (_req, file, cb) => {
  if (allowedTypes.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new ErrorHandler(`File type "${file.mimetype}" is not allowed.`, 400),
      false,
    );
  }
};

// ─── Multer instances ─────────────────────────────────────────────────────────

/**
 * For avatar / org / team / group chat icon uploads.
 * Usage: router.patch('/avatar', iconUpload.single('icon'), handler)
 */
export const iconUpload = multer({
  storage,
  limits: { fileSize: ICON_MAX_SIZE },
  fileFilter: makeFileFilter(ICON_MIME_TYPES),
});

/**
 * For single-file message attachments.
 * Usage: router.post('/messages', attachmentUpload.single('file'), handler)
 */
export const attachmentUpload = multer({
  storage,
  limits: { fileSize: ATTACHMENT_MAX_SIZE },
  fileFilter: makeFileFilter(ATTACHMENT_MIME_TYPES),
});

/**
 * For multi-file message attachments (up to 10).
 * Usage: router.post('/messages', multiAttachment.array('files', 10), handler)
 */
export const multiAttachment = multer({
  storage,
  limits: { fileSize: ATTACHMENT_MAX_SIZE },
  fileFilter: makeFileFilter(ATTACHMENT_MIME_TYPES),
});

// ─── Multer error handler middleware ─────────────────────────────────────────

/**
 * Express error middleware — place after any route that uses multer.
 * Translates multer errors into clean JSON responses.
 *
 * Usage (in app.js, after routes):
 *   app.use(handleMulterError);
 */
export const handleMulterError = (err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE: "File is too large.",
      LIMIT_FILE_COUNT: "Too many files uploaded at once.",
      LIMIT_UNEXPECTED_FILE: "Unexpected field name in form data.",
    };
    return res.status(400).json({
      success: false,
      message: messages[err.code] ?? "File upload error.",
      code: err.code,
    });
  }

  if (err?.code === "INVALID_FILE_TYPE") {
    return res.status(415).json({
      success: false,
      message: err.message,
      code: err.code,
    });
  }

  next(err);
};
