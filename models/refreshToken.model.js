import mongoose, { model, Schema, Types } from "mongoose";

const { ObjectId } = Types;

const refreshTokenSchema = new Schema(
  {
    userId: { type: ObjectId, ref: "User", required: true },
    tokenHash: { type: String, required: true },

    device: { type: String, default: null },
    browser: { type: String, default: null },
    operatingSystem: { type: String, default: null },
    ipAddress: { type: String, default: null },

    expiresAt: { type: Date, required: true },
    isRevoked: { type: Boolean, default: false },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

refreshTokenSchema.index({ tokenHash: 1 }, { unique: true });
refreshTokenSchema.index({ userId: 1 });

export const RefreshToken =
  mongoose.models.RefreshToken || model("RefreshToken", refreshTokenSchema);
