import mongoose, { model, Schema, Types } from "mongoose";
import {
  USER_CUSTOM_STATUS_VALUES,
  USER_STATUS,
  USER_STATUS_VALUES,
} from "../constants/user.constants.js";

const { ObjectId } = Types;

const userStatusSchema = new Schema(
  {
    userId: { type: ObjectId, ref: "User", required: true, unique: true },

    // System-managed via socket events
    status: {
      type: String,
      enum: USER_STATUS_VALUES,
      default: USER_STATUS.OFFLINE,
    },

    // User-managed manually (like Teams "Do not disturb")
    customStatus: {
      type: String,
      enum: USER_CUSTOM_STATUS_VALUES,
      default: null,
    },
    lastSeenAt: { type: Date, default: null },
  },
  { timestamps: true },
);

userStatusSchema.index({ userId: 1 }, { unique: true });
userStatusSchema.index({ status: 1 });

export const UserStatus =
  mongoose.models.UserStatus || model("UserStatus", userStatusSchema);
