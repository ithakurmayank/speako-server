import mongoose, { model, Schema, Types } from "mongoose";

const { ObjectId } = Types;

const userStatusSchema = new Schema(
  {
    userId: { type: ObjectId, ref: "User", required: true, unique: true },

    // System-managed via socket events
    status: {
      type: String,
      enum: ["online", "offline", "away"],
      default: "offline",
    },

    // User-managed manually (like Teams "Do not disturb")
    customStatus: {
      type: String,
      enum: [
        "active",
        "busy",
        "do_not_disturb",
        "be_right_back",
        "appear_away",
        "appear_offline",
        null,
      ],
      default: null,
    },
    lastSeenAt: { type: Date, default: null },
    // activeSocketId: { type: String, default: null }, // most recent socket connection
  },
  { timestamps: true },
);

userStatusSchema.index({ userId: 1 }, { unique: true });
userStatusSchema.index({ status: 1 });

export const UserStatus =
  mongoose.models.UserStatus || model("UserStatus", userStatusSchema);
