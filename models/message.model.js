import mongoose, { model, Schema, Types } from "mongoose";
import {
  GROUP_MESSAGE_STATUS_VALUES,
  MESSAGE_TYPES_VALUES,
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

    clientMessageId: { type: String, required: true },

    // Context — exactly ONE set:
    channelId: { type: ObjectId, ref: "Channel", default: null },
    conversationId: { type: ObjectId, ref: "Conversation", default: null },

    //Decides message display style in UI
    messageType: {
      type: String,
      required: true,
      enum: MESSAGE_TYPES_VALUES,
    },
    content: { type: String, default: "", maxlength: 10000 },
    attachments: [{ type: ObjectId, ref: "File" }], // references File collection

    reactions: { type: [reactionSchema], default: [] },

    // Threads:
    threadId: { type: ObjectId, ref: "Message", default: null }, // null = root message
    replyCount: { type: Number, default: 0 }, // only meaningful on root messages
    lastReplyAt: { type: Date, default: null }, //replies needs to show "5 replies, last reply 2h ago.

    mentions: [{ type: ObjectId, ref: "User" }],

    dmDeliveredAt: { type: Date, default: null },
    dmSeenAt: { type: Date, default: null },

    // Group chat delivery state (≤GROUP_RECEIPT_THRESHOLD participants only). No delivery states are created for channels
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

messageSchema.index(
  { channelId: 1, senderId: 1, clientMessageId: 1 },
  {
    unique: true,
    partialFilterExpression: { channelId: { $exists: true, $ne: null } },
  },
);
messageSchema.index(
  { conversationId: 1, senderId: 1, clientMessageId: 1 },
  {
    unique: true,
    partialFilterExpression: { conversationId: { $exists: true, $ne: null } },
  },
);

export const Message =
  mongoose.models.Message || model("Message", messageSchema);
