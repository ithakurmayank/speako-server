import { OTP_PURPOSES_VALUES } from "#constants/common.constants.js";
import mongoose, { model, Schema, Types } from "mongoose";

const { ObjectId } = Types;

const otpVerificationSchema = new Schema(
  {
    userId: { type: ObjectId, ref: "User", required: true },

    otpHash: { type: String, required: true, maxlength: 512 },

    purpose: {
      type: String,
      enum: OTP_PURPOSES_VALUES,
      required: true,
    },

    expiresAt: { type: Date, required: true },

    isUsed: { type: Boolean, default: false },
    usedAt: { type: Date, default: null },

    ipAddress: { type: String, default: null, maxlength: 64 },
  },
  {
    timestamps: true,
  },
);

otpVerificationSchema.index(
  { userId: 1, purpose: 1 },
  { partialFilterExpression: { isUsed: false } },
);

otpVerificationSchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0, // delete as soon as expiresAt is in the past
    partialFilterExpression: { isUsed: false }, // only delete unused ones
  },
);

export const OtpVerification =
  mongoose.models.OtpVerification ||
  model("OtpVerification", otpVerificationSchema);
