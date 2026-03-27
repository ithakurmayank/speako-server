import mongoose, { model, Schema, Types } from "mongoose";
import {
  DM_MESSAGE_STATUS_VALUES,
  GROUP_MESSAGE_STATUS_VALUES,
} from "../constants/message.constants.js";

const { ObjectId } = Types;

const reactionSchema = new Schema(
  {
    emoji: { type: String, required: true },
    users: [{ type: ObjectId, ref: "User" }],
  },
  { _id: false },
);

const receiptSchema = new Schema(
  {
    userId: { type: ObjectId, ref: "User", required: true },
    status: { type: String, enum: GROUP_MESSAGE_STATUS_VALUES, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false },
);

const messageSchema = new Schema(
  {
    senderId: { type: ObjectId, ref: "User", required: true },

    // Context — exactly ONE set:
    channelId: { type: ObjectId, ref: "Channel", default: null },
    conversationId: { type: ObjectId, ref: "Conversation", default: null },

    isSystem: { type: Boolean, default: false },
    content: { type: String, default: "", maxlength: 10000 },
    attachments: [{ type: ObjectId, ref: "File" }], // references File collection

    reactions: { type: [reactionSchema], default: [] },

    // Threads:
    threadId: { type: ObjectId, ref: "Message", default: null }, // null = root message
    replyCount: { type: Number, default: 0 }, // only meaningful on root messages
    lastReplyAt: { type: Date, default: null }, //replies needs to show "5 replies, last reply 2h ago.

    mentions: [{ type: ObjectId, ref: "User" }],

    // 1-on-1 DM delivery state:
    dmStatus: {
      type: String,
      enum: DM_MESSAGE_STATUS_VALUES,
      default: null,
    },
    dmDeliveredAt: { type: Date, default: null },
    dmSeenAt: { type: Date, default: null },

    // Group chat delivery state (≤20 participants only):
    receipts: { type: [receiptSchema], default: [] },

    // Edit tracking:
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },

    // Soft delete:
    deletedAt: { type: Date, default: null },
    deletedBy: { type: ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

// Primary feed — using _id as cursor (always indexed, no extra field needed)
messageSchema.index(
  { channelId: 1, _id: -1 },
  { partialFilterExpression: { deletedAt: null }, name: "channel_feed" },
);
messageSchema.index(
  { conversationId: 1, _id: -1 },
  { partialFilterExpression: { deletedAt: null }, name: "conversation_feed" },
);

// Thread replies:
messageSchema.index({ threadId: 1, _id: 1 });

// Root messages that have threads (replyCount > 0 = has a thread):
messageSchema.index(
  { channelId: 1, replyCount: 1, _id: -1 },
  { partialFilterExpression: { threadId: null } }, // only root messages
);

// Mentions:
messageSchema.index({ mentions: 1, _id: -1 });

export const Message =
  mongoose.models.Message || model("Message", messageSchema);
