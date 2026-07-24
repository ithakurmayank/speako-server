import mongoose, { model, Schema, Types } from "mongoose";
import {
  CLOUDINARY_RESOURCE_TYPES_VALUES,
  FILE_STATUSES,
  FILE_STATUSES_VALUES,
  FILE_TYPES_VALUES,
} from "../constants/fileTypes.constants.js";

const { ObjectId } = Types;

const fileSchema = new Schema(
  {
    uploadedByUserId: { type: ObjectId, ref: "User", required: true },

    // Where this file was uploaded from — one of these is set:
    channelId: { type: ObjectId, ref: "Channel", default: null },
    conversationId: { type: ObjectId, ref: "Conversation", default: null },

    status: {
      type: String,
      enum: FILE_STATUSES_VALUES,
      default: FILE_STATUSES.ATTACHED,
      required: true,
    },
    expiresAt: {
      type: Date,
      default: null,
    },

    // Cloudinary data:
    url: { type: String, required: true }, // secure_url
    publicId: { type: String, required: true }, // for deletion
    cloudinaryResourceType: {
      type: String,
      enum: CLOUDINARY_RESOURCE_TYPES_VALUES,
      required: true,
    },

    // Derived from mimeType at upload time. Used for UI icons, file tabs,
    // filtering ("show only images"), and preview rendering decisions.
    fileType: {
      type: String,
      enum: FILE_TYPES_VALUES,
      required: true,
    },

    // File metadata:
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeInBytes: { type: Number, required: true },

    // Image/video dimensions (null for raw files):
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    duration: { type: Number, default: null }, // seconds, video only
    thumbnailUrl: { type: String, default: null }, // Cloudinary-generated thumbnail

    createdBy: {
      type: ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: ObjectId,
      ref: "User",
      default: null,
    },
    deletedBy: {
      type: ObjectId,
      ref: "User",
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

fileSchema.index({ uploadedByUserId: 1 });
fileSchema.index({ channelId: 1, createdAt: -1 }); // Files tab in channel
fileSchema.index({ conversationId: 1, createdAt: -1 }); // Files tab in DM
fileSchema.index({ publicId: 1 }, { unique: true });

fileSchema.pre("validate", function (next) {
  const scopes = [this.channelId, this.conversationId];

  const count = scopes.filter((v) => v != null).length;

  if (count !== 1) {
    return next(
      new Error(
        "Exactly one of channelId or conversationId must be specified.",
      ),
    );
  }

  next();
});

fileSchema.pre("validate", function (next) {
  if (this.status === FILE_STATUSES.PENDING && !this.expiresAt) {
    return next(new Error("expiresAt is required when status is pending."));
  }

  if (this.status === FILE_STATUSES.ATTACHED && this.expiresAt) {
    return next(new Error("expiresAt must be null when status is attached."));
  }

  next();
});

export const File = mongoose.models.File || model("File", fileSchema);
