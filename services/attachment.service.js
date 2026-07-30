import { FILE_TTL_EXPIRY_SECONDS } from "#constants/common.constants.js";
import { EXCEPTION_CODES } from "#constants/exceptionCodes.constants.js";
import { FILE_STATUSES } from "#constants/fileTypes.constants.js";
import { deleteCloudinaryFile, uploadAttachment } from "#lib/cloudinary.lib.js";
import { File } from "#models/file.model.js";
import { ErrorHandler } from "#utils/errorHandler.util.js";
import dayjs from "dayjs";

//#region GET services

//#endregion

//#region UPDATE services
const uploadChannelAttachment = async ({
  orgId,
  teamId,
  channelId,
  userId,
  file,
}) => {
  // Step 1: Validate file presence
  // Multer handles mime type filtering and size limits via middleware.
  // We still guard against a missing file in case middleware is misconfigured.
  if (!file) {
    throw new ErrorHandler("No file provided.", EXCEPTION_CODES.INVALID_INPUT);
  }

  // Step 2: Upload to Cloudinary
  // Upload first — if the DB insert fails we delete the asset in the catch block.
  const uploadResult = await uploadAttachment(file.buffer, file.mimetype, {
    orgId,
    teamId,
    channelId,
    date: new Date(),
  });

  // Step 3: Persist the File doc as "pending"
  // Status is PENDING until the user actually sends the message.
  // expiresAt ensures orphaned uploads (user closed composer) are auto-cleaned.
  // No channelId/conversationId yet — those are set when the message is sent.
  const expiresAt = dayjs().add(FILE_TTL_EXPIRY_SECONDS, "second").toDate();

  let fileDoc;
  try {
    fileDoc = await File.create({
      uploadedByUserId: userId,
      url: uploadResult.url,
      publicId: uploadResult.publicId,
      cloudinaryResourceType: uploadResult.cloudinaryResourceType,
      fileType: uploadResult.fileType,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeInBytes: file.size,
      width: uploadResult.width ?? null,
      height: uploadResult.height ?? null,
      duration: uploadResult.duration ?? null,
      thumbnailUrl: uploadResult.thumbnailUrl ?? null,
      status: FILE_STATUSES.PENDING,
      expiresAt,
      channelId: null,
      conversationId: null,
      createdBy: userId,
    });
  } catch (err) {
    // Step 4: DB insert failed — delete the Cloudinary asset immediately
    // so we don't leak storage for an asset that has no File record.
    try {
      await deleteCloudinaryFile(
        uploadResult.publicId,
        uploadResult.cloudinaryResourceType,
      );
    } catch (cleanupErr) {
      console.warn(
        `Failed to delete Cloudinary asset after DB insert failure. PublicId: ${uploadResult.publicId}`,
        cleanupErr,
      );
    }
    throw err;
  }

  // Step 5: Return the pre-upload response
  // Client holds FileId and passes it in SendMessageDto.fileIds when sending.
  return {
    fileId: fileDoc._id,
    url: fileDoc.url,
    thumbnailUrl: fileDoc.thumbnailUrl ?? null,
    originalName: fileDoc.originalName,
    mimeType: fileDoc.mimeType,
    sizeInBytes: fileDoc.sizeInBytes,
    fileType: fileDoc.fileType,
    expiresAt: fileDoc.expiresAt,
  };
};

const uploadConversationAttachment = async ({
  conversationId,
  userId,
  file,
}) => {
  // Step 1: Validate file presence
  // Multer handles mime type filtering and size limits via middleware.
  // We still guard against a missing file in case middleware is misconfigured.
  if (!file) {
    throw new ErrorHandler("No file provided.", EXCEPTION_CODES.INVALID_INPUT);
  }

  // Step 2: Upload to Cloudinary
  // Upload first — if the DB insert fails we delete the asset in the catch block.
  const uploadResult = await uploadAttachment(file.buffer, file.mimetype, {
    conversationId,
    date: new Date(),
  });

  // Step 3: Persist the File doc as "pending"
  // Status is PENDING until the user actually sends the message.
  // expiresAt ensures orphaned uploads (user closed composer) are auto-cleaned.
  // No channelId/conversationId yet — those are set when the message is sent.
  const expiresAt = dayjs().add(FILE_TTL_EXPIRY_SECONDS, "second").toDate();

  let fileDoc;
  try {
    fileDoc = await File.create({
      uploadedByUserId: userId,
      url: uploadResult.url,
      publicId: uploadResult.publicId,
      cloudinaryResourceType: uploadResult.cloudinaryResourceType,
      fileType: uploadResult.fileType,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeInBytes: file.size,
      width: uploadResult.width ?? null,
      height: uploadResult.height ?? null,
      duration: uploadResult.duration ?? null,
      thumbnailUrl: uploadResult.thumbnailUrl ?? null,
      status: FILE_STATUSES.PENDING,
      expiresAt,
      channelId: null,
      conversationId: null,
      createdBy: userId,
    });
  } catch (err) {
    // Step 4: DB insert failed — delete the Cloudinary asset immediately
    // so we don't leak storage for an asset that has no File record.
    try {
      await deleteCloudinaryFile(
        uploadResult.publicId,
        uploadResult.cloudinaryResourceType,
      );
    } catch (cleanupErr) {
      console.warn(
        `Failed to delete Cloudinary asset after DB insert failure. PublicId: ${uploadResult.publicId}`,
        cleanupErr,
      );
    }
    throw err;
  }

  // Step 5: Return the pre-upload response
  // Client holds FileId and passes it in SendMessageDto.fileIds when sending.
  return {
    fileId: fileDoc._id,
    url: fileDoc.url,
    thumbnailUrl: fileDoc.thumbnailUrl ?? null,
    originalName: fileDoc.originalName,
    mimeType: fileDoc.mimeType,
    sizeInBytes: fileDoc.sizeInBytes,
    fileType: fileDoc.fileType,
    expiresAt: fileDoc.expiresAt,
  };
};
//#endregion

export const attachmentService = {
  uploadChannelAttachment,
  uploadConversationAttachment,
};
