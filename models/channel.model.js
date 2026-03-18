import mongoose, { model, Schema, Types } from "mongoose";
import {
  CHANNEL_TYPES,
  CHANNEL_TYPES_VALUES,
} from "../constants/channel.constants.js";

const { ObjectId } = Types;

const channelSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, default: null, maxlength: 1024 },

    teamId: { type: ObjectId, ref: "Team", required: true },
    orgId: { type: ObjectId, ref: "Organization", required: true }, // denormalized

    type: {
      type: String,
      enum: CHANNEL_TYPES_VALUES, // announcement = only mods can post
      default: CHANNEL_TYPES.TEXT,
    },

    isPrivate: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
    archivedBy: { type: ObjectId, ref: "User", default: null },
    updatedBy: { type: ObjectId, ref: "User" },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: ObjectId, ref: "User", default: null },
    createdBy: { type: ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

channelSchema.index({ teamId: 1 });
channelSchema.index({ teamId: 1, isArchived: 1 });
channelSchema.index({ teamId: 1, name: 1 }, { unique: true }); // no duplicate names within team

export const Channel =
  mongoose.models.Channel || model("Channel", channelSchema);
