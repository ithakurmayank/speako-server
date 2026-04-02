import mongoose, { model, Schema, Types } from "mongoose";
import {
  CLOUDINARY_RESOURCE_TYPES_VALUES,
  FILE_TYPES_VALUES,
} from "../constants/fileTypes.constants.js";

const { ObjectId } = Types;

const fileSchema = new Schema(
  {
    uploadedBy: { type: ObjectId, ref: "User", required: true },
    orgId: { type: ObjectId, ref: "Organization", default: null },

    // Where this file was uploaded from — one of these is set:
    channelId: { type: ObjectId, ref: "Channel", default: null },
    conversationId: { type: ObjectId, ref: "Conversation", default: null },

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
  },
  { timestamps: true },
);

fileSchema.index({ uploadedBy: 1 });
fileSchema.index({ channelId: 1, createdAt: -1 }); // Files tab in channel
fileSchema.index({ conversationId: 1, createdAt: -1 }); // Files tab in DM
fileSchema.index({ publicId: 1 }, { unique: true });

export const File = mongoose.models.File || model("File", fileSchema);
