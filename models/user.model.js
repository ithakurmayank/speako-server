import { hash } from "bcrypt";
import mongoose, { model, Schema, Types } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },

    icon: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },
    bio: { type: String },
    isEmailVerified: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("passwordHash")) {
    return next();
  }

  this.passwordHash = await hash(this.passwordHash, 10);
});

export const User = mongoose.models.User || model("User", userSchema);
