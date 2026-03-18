const CLOUDINARY_RESOURCE_TYPES = Object.freeze({
  IMAGE: "image",
  VIDEO: "video",
  RAW: "raw",
});

const CLOUDINARY_RESOURCE_TYPES_VALUES = Object.values(
  CLOUDINARY_RESOURCE_TYPES,
);

const FILE_TYPES = Object.freeze({
  IMAGE: "image",
  VIDEO: "video",
  AUDIO: "audio",
  DOCUMENT: "document",
  ARCHIVE: "archive",
  CODE: "code",
  OTHER: "other",
});

const FILE_TYPES_VALUES = Object.values(FILE_TYPES);

const IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/avif",
]);

const VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-msvideo",
  "video/x-matroska",
]);

const AUDIO_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/mp4",
  "audio/aac",
  "audio/flac",
  "audio/x-m4a",
]);

const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const ARCHIVE_MIME_TYPES = new Set([
  "application/zip",
  "application/x-rar-compressed",
  "application/x-tar",
  "application/gzip",
  "application/x-7z-compressed",
]);

const CODE_MIME_TYPES = new Set([
  "text/javascript",
  "application/javascript",
  "text/typescript",
  "text/x-python",
  "text/html",
  "text/css",
  "application/json",
  "text/xml",
  "application/xml",
  "text/x-sh",
  "text/x-csrc",
  "text/x-c++src",
  "text/x-java-source",
]);

export {
  CLOUDINARY_RESOURCE_TYPES,
  CLOUDINARY_RESOURCE_TYPES_VALUES,
  FILE_TYPES,
  FILE_TYPES_VALUES,
  CODE_MIME_TYPES,
  ARCHIVE_MIME_TYPES,
  DOCUMENT_MIME_TYPES,
  AUDIO_MIME_TYPES,
  VIDEO_MIME_TYPES,
  IMAGE_MIME_TYPES,
};
