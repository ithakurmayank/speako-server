import mongoose, { Schema, Types, model } from "mongoose";
import {
  GROUP_ROLES,
  GROUP_ROLES_VALUES,
} from "../constants/roles.constants.js";

const { ObjectId } = Types;

const conversationParticipantSchema = new Schema(
  {
    conversationId: {
      type: ObjectId,
      ref: "Conversation",
      required: true,
    },

    userId: {
      type: ObjectId,
      ref: "User",
      required: true,
    },

    role: {
      type: String,
      enum: GROUP_ROLES_VALUES,
      default: GROUP_ROLES.GroupMember,
      required: true,
    },

    addedBy: {
      type: ObjectId,
      ref: "User",
      required: true,
    },

    joinedAt: {
      type: Date,
      default: Date.now,
    },

    hasLeft: {
      type: Boolean,
      default: false,
    },

    leftAt: {
      type: Date,
      default: null,
    },

    rejoinedAt: {
      type: Date,
      default: null,
    },

    rejoinedBy: {
      type: ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: false,
  },
);

conversationParticipantSchema.pre("validate", function (next) {
  if (this.hasLeft && !this.leftAt)
    return next(new Error("leftAt is required when hasLeft=true."));

  if (!this.hasLeft && this.leftAt)
    return next(new Error("leftAt must be null when hasLeft=false."));

  next();
});

conversationParticipantSchema.index(
  {
    conversationId: 1,
    userId: 1,
  },
  {
    unique: true,
  },
);

conversationParticipantSchema.index({
  conversationId: 1,
});

conversationParticipantSchema.index({
  userId: 1,
});

conversationParticipantSchema.index({
  conversationId: 1,
  hasLeft: 1,
});

export const ConversationParticipant =
  mongoose.models.ConversationParticipant ||
  model("ConversationParticipant", conversationParticipantSchema);
