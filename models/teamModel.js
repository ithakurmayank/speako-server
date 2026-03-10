import mongoose, { model, Schema, Types } from "mongoose";

const { ObjectId } = Types;

const teamSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null, maxlength: 1024 },

    orgId: { type: ObjectId, ref: "Organization", required: true },
    createdBy: { type: ObjectId, ref: "User", required: true },

    icon: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },
    updatedBy: { type: ObjectId, ref: "User" },
    isPrivate: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

teamSchema.index({ orgId: 1 });
teamSchema.index({ orgId: 1, isArchived: 1 });

export const Team = mongoose.models.Team || model("Team", teamSchema);
