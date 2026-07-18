import mongoose, { Schema, Types, model } from "mongoose";
import {
  CONVERSATION_TYPES,
  CONVERSATION_TYPES_VALUES,
} from "../constants/conversation.constants.js";

const { ObjectId } = Types;

const conversationSchema = new Schema(
  {
    type: {
      type: String,
      enum: CONVERSATION_TYPES_VALUES,
      required: true,
    },

    // Group only
    name: {
      type: String,
      trim: true,
      maxlength: 150,
      default: null,
    },

    logo: {
      url: {
        type: String,
        default: null,
      },
      publicId: {
        type: String,
        default: null,
      },
    },

    // Direct only
    directParticipantAId: {
      type: ObjectId,
      ref: "User",
      default: null,
    },
    directParticipantBId: {
      type: ObjectId,
      ref: "User",
      default: null,
    },

    lastMessageAt: {
      type: Date,
      default: null,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },

    createdBy: {
      type: ObjectId,
      ref: "User",
      default: null,
    },

    updatedBy: {
      type: ObjectId,
      ref: "User",
      default: null,
    },

    deletedBy: {
      type: ObjectId,
      ref: "User",
      default: null,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

conversationSchema.pre("validate", function (next) {
  if (this.type === CONVERSATION_TYPES.DIRECT) {
    if (!this.directParticipantAId || !this.directParticipantBId) {
      return next(new Error("Direct conversation requires two participants."));
    }

    if (this.name)
      return next(new Error("Direct conversation cannot have a name."));

    if (this.logo?.url || this.logo?.publicId)
      return next(new Error("Direct conversation cannot have a logo."));

    const a = this.directParticipantAId.toString();
    const b = this.directParticipantBId.toString();

    if (a === b)
      return next(new Error("Direct participants cannot be the same."));

    if (a > b) {
      const temp = this.directParticipantAId;
      this.directParticipantAId = this.directParticipantBId;
      this.directParticipantBId = temp;
    }
  }

  if (this.type === CONVERSATION_TYPES.GROUP) {
    if (!this.name?.trim()) return next(new Error("Group must have a name."));

    this.directParticipantAId = null;
    this.directParticipantBId = null;
  }

  next();
});

conversationSchema.index(
  {
    directParticipantAId: 1,
    directParticipantBId: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      type: CONVERSATION_TYPES.DIRECT,
    },
  },
);

conversationSchema.index({
  lastMessageAt: -1,
});

export const Conversation =
  mongoose.models.Conversation || model("Conversation", conversationSchema);
