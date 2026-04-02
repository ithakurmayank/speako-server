import { ALL_ROLES } from "#constants/roles.constants.js";
import mongoose, { model, Schema, Types } from "mongoose";

const { ObjectId } = Types;

const invitationSchema = new Schema(
  {
    orgId: { type: ObjectId, ref: "Organization", required: true },
    createdBy: { type: ObjectId, ref: "User", required: true },

    email: { type: String, required: true, lowercase: true },
    role: {
      type: String,
      enum: [ALL_ROLES.OrgAdmin, ALL_ROLES.OrgMember, ALL_ROLES.OrgGuest],
      default: ALL_ROLES.OrgMember,
    },
    token: { type: String, required: true, unique: true },

    isUsed: { type: Boolean, default: false },
    usedAt: { type: Date, default: null },
    usedBy: { type: ObjectId, ref: "User", default: null },

    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
invitationSchema.index(
  { email: 1, orgId: 1 },
  { unique: true, partialFilterExpression: { isUsed: false } },
);

export const Invitation =
  mongoose.models.Invitation || model("Invitation", invitationSchema);
