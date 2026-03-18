import mongoose, { model, Schema, Types } from "mongoose";
import {
  CONVERSATION_TYPES,
  CONVERSATION_TYPES_VALUES,
} from "../constants/conversation.constants.js";
import {
  GROUP_ROLES,
  GROUP_ROLES_VALUES,
} from "../constants/roles.constants.js";

const { ObjectId } = Types;

const participantSchema = new Schema(
  {
    userId: { type: ObjectId, ref: "User", required: true },
    role: {
      type: String,
      enum: GROUP_ROLES_VALUES,
      default: GROUP_ROLES.GroupMember,
    },
    joinedAt: { type: Date, default: Date.now },
    addedBy: { type: ObjectId, ref: "User", default: null },
    hasLeft: { type: Boolean, default: false },
    leftAt: { type: Date, default: null },
  },
  { _id: false },
);

const conversationSchema = new Schema(
  {
    type: { type: String, enum: CONVERSATION_TYPES_VALUES, required: true },

    orgId: { type: ObjectId, ref: "Organization", required: true },

    // Group chat only:
    name: { type: String, default: null, trim: true, maxlength: 128 },
    icon: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },
    createdBy: { type: ObjectId, ref: "User", default: null },
    updatedBy: { type: ObjectId, ref: "User" },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: ObjectId, ref: "User", default: null },

    participants: {
      type: [participantSchema],
      required: true,
      validate: {
        validator(arr) {
          if (this.type === CONVERSATION_TYPES.DIRECT) return arr.length === 2;
          if (this.type === CONVERSATION_TYPES.GROUP)
            return arr.length >= 2 && arr.length <= 200;
          return false;
        },
        message: "Direct: exactly 2 participants. Group: 2–200 participants.",
      },
    },
  },
  { timestamps: true },
);

conversationSchema.index({ "participants.userId": 1, orgId: 1 });
conversationSchema.index(
  { _id: 1, "participants.userId": 1 },
  { unique: true },
);

export const Conversation =
  mongoose.models.Conversation || model("Conversation", conversationSchema);
