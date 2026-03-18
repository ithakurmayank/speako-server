import dayjs from "dayjs";
import { Readable } from "stream";
import {
  ARCHIVE_MIME_TYPES,
  AUDIO_MIME_TYPES,
  CLOUDINARY_RESOURCE_TYPES,
  CLOUDINARY_RESOURCE_TYPES_VALUES,
  CODE_MIME_TYPES,
  DOCUMENT_MIME_TYPES,
  FILE_TYPES,
  IMAGE_MIME_TYPES,
  VIDEO_MIME_TYPES,
} from "../constants/fileTypes.constants.js";
import cloudinary from "../configs/cloudinary.config.js";
import { ErrorHandler } from "../utils/errorHandler.util.js";
import { EXCEPTION_CODES } from "../constants/exceptionCodes.constants.js";

const getFileType = (mimeType) => {
  switch (true) {
    case IMAGE_MIME_TYPES.has(mimeType):
      return FILE_TYPES.IMAGE;

    case VIDEO_MIME_TYPES.has(mimeType):
      return FILE_TYPES.VIDEO;

    case AUDIO_MIME_TYPES.has(mimeType):
      return FILE_TYPES.AUDIO;

    case DOCUMENT_MIME_TYPES.has(mimeType):
      return FILE_TYPES.DOCUMENT;

    case ARCHIVE_MIME_TYPES.has(mimeType):
      return FILE_TYPES.ARCHIVE;

    case CODE_MIME_TYPES.has(mimeType):
      return FILE_TYPES.CODE;

    // Plain text could be code or note — treat as code for preview purposes
    case mimeType.startsWith("text/"):
      return FILE_TYPES.CODE;

    default:
      return FILE_TYPES.OTHER;
  }
};

const getCloudinaryResourceType = (mimeType) => {
  if (mimeType.startsWith("image/")) return CLOUDINARY_RESOURCE_TYPES.IMAGE;
  if (mimeType.startsWith("video/")) return CLOUDINARY_RESOURCE_TYPES.VIDEO;
  // Cloudinary treats audio as "video" resource type internally
  if (mimeType.startsWith("audio/")) return CLOUDINARY_RESOURCE_TYPES.VIDEO;
  return CLOUDINARY_RESOURCE_TYPES.RAW;
};

const getMonthPartition = (date = new Date()) => dayjs(date).format("MM-YYYY");

const userAvatarFolder = (userId) => `users/${userId}`;

const orgIconFolder = (orgId) => `${orgId}/org/assets`;

const teamIconFolder = (orgId, teamId) => `${orgId}/teams/${teamId}`;

const groupIconFolder = (orgId, conversationId) =>
  `${orgId}/conversations/${conversationId}`;

const channelAttachmentFolder = (orgId, channelId, date) =>
  `${orgId}/channels/${channelId}/${getMonthPartition(date)}`;

const conversationAttachmentFolder = (orgId, conversationId, date) =>
  `${orgId}/conversations/${conversationId}/${getMonthPartition(date)}`;

const orgRootPrefix = (orgId) => `${orgId}/`;

const uploadBufferToCloudinary = (buffer, options) =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );
    Readable.from(buffer).pipe(uploadStream);
  });

const uploadAttachment = async (buffer, mimeType, context) => {
  const { orgId, channelId, conversationId, date } = context;

  if (!channelId && !conversationId) {
    throw new ErrorHandler(
      "Provide channelId or conversationId",
      EXCEPTION_CODES.MISSING_REQUIRED_FIELDS,
    );
  }

  const folder = channelId
    ? channelAttachmentFolder(orgId, channelId, date)
    : conversationAttachmentFolder(orgId, conversationId, date);

  const resourceType = getCloudinaryResourceType(mimeType);

  const result = await uploadBufferToCloudinary(buffer, {
    folder,
    resource_type: resourceType,
    ...(resourceType === CLOUDINARY_RESOURCE_TYPES.VIDEO && {
      eager: [{ format: "jpg", transformation: [{ quality: "auto" }] }],
      eager_async: true,
    }),
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    cloudinaryResourceType: resourceType,
    fileType: getFileType(mimeType),
    width: result.width ?? null,
    height: result.height ?? null,
    duration: result.duration ?? null, //for videos/audio only
    thumbnailUrl: result.eager?.[0]?.secure_url ?? null,
  };
};

const uploadIcon = async (buffer, entityType, ids) => {
  const { userId, orgId, teamId, conversationId } = ids;

  const folderMap = {
    user: () => userAvatarFolder(userId),
    org: () => orgIconFolder(orgId),
    team: () => teamIconFolder(orgId, teamId),
    group: () => groupIconFolder(orgId, conversationId),
  };

  if (!folderMap[entityType]) {
    throw new ErrorHandler(
      `uploadIcon: unknown entityType "${entityType}"`,
      EXCEPTION_CODES.INVALID_INPUT,
    );
  }

  const folder = folderMap[entityType]();
  const publicId = `${folder}/icon`;

  const result = await uploadBufferToCloudinary(buffer, {
    public_id: publicId,
    overwrite: true,
    invalidate: true, // bust Cloudinary CDN cache for the old icon
    resource_type: CLOUDINARY_RESOURCE_TYPES.IMAGE,
    transformation: [
      { width: 256, height: 256, crop: "fill", gravity: "auto" },
      { fetch_format: "auto", quality: "auto" },
    ],
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
};

const deleteCloudinaryFile = async (publicId, cloudinaryResourceType) => {
  const response = await cloudinary.uploader.destroy(publicId, {
    resource_type: cloudinaryResourceType,
    invalidate: true,
  });

  // "not found" is fine in case user clicks delete attachment two times simultaneously
  if (response.result !== "ok" && response.result !== "not found") {
    throw new ErrorHandler(
      `Cloudinary delete failed for "${publicId}": ${response.result}`,
      EXCEPTION_CODES.FILE_DELETE_FAILED,
    );
  }
};

// for later use, used when hard deleting an organization
const deleteAllOrgFiles = async (orgId) => {
  const prefix = orgRootPrefix(orgId);

  await Promise.all(
    CLOUDINARY_RESOURCE_TYPES_VALUES.map((resourceType) =>
      cloudinary.api.delete_resources_by_prefix(prefix, {
        resource_type: resourceType,
      }),
    ),
  );
};

export {
  getFileType,
  uploadAttachment,
  uploadIcon,
  deleteCloudinaryFile,
  deleteAllOrgFiles,
};
