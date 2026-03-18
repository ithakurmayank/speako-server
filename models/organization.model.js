import mongoose, { model, Schema, Types } from "mongoose";

const { ObjectId } = Types;

const organizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    icon: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },

    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: ObjectId, ref: "User", default: null },
    createdBy: { type: ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const Organization =
  mongoose.models.Organization || model("Organization", organizationSchema);
