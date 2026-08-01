import mongoose, { model, Schema, Types } from "mongoose";
import {
  MESSAGE_MAX_CONTEXT_LENGTH,
  MESSAGE_TYPES_VALUES,
} from "../constants/message.constants.js";
import { EXCEPTION_CODES } from "#constants/exceptionCodes.constants.js";
import { ErrorHandler } from "#utils/errorHandler.util.js";

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
    deliveredAt: { type: Date, default: null },
    seenAt: { type: Date, default: null },
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
    content: {
      type: String,
      default: "",
      maxlength: MESSAGE_MAX_CONTEXT_LENGTH,
    },
    attachments: [{ type: ObjectId, ref: "File" }], // references File collection

    reactions: { type: [reactionSchema], default: [] },

    // Threads:
    threadId: { type: ObjectId, ref: "Message", default: null }, // null = root message
    replyCount: { type: Number, default: 0 }, // only meaningful on root messages
    lastReplyAt: { type: Date, default: null }, //replies needs to show "5 replies, last reply 2h ago.

    mentions: [{ type: ObjectId, ref: "User" }],

    dmDeliveredAt: { type: Date, default: null },
    dmSeenAt: { type: Date, default: null },

    // Manages Group chat delivery state (≤GROUP_RECEIPT_THRESHOLD participants only). No delivery states(receipts) are created for channels
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

messageSchema.pre("validate", function () {
  // exactly one of channelId / conversationId must be set
  const scopes = [this.channelId, this.conversationId];
  const setCount = scopes.filter((v) => v != null).length;

  if (setCount !== 1) {
    throw new ErrorHandler(
      "Exactly one of channelId or conversationId must be set",
      EXCEPTION_CODES.INTERNAL_SERVER_ERROR,
    );
  }

  // a message cannot be its own thread root
  if (
    this.threadId &&
    this._id &&
    this.threadId.toString() === this._id.toString()
  ) {
    throw new ErrorHandler(
      "threadId cannot reference the message itself",
      EXCEPTION_CODES.INTERNAL_SERVER_ERROR,
    );
  }

  // replyCount is only meaningful on root messages
  if (this.threadId && this.replyCount > 0) {
    throw new ErrorHandler(
      "replyCount must be 0 on thread reply messages",
      EXCEPTION_CODES.INTERNAL_SERVER_ERROR,
    );
  }

  // replyCount / lastReplyAt must move together
  const hasReplies = this.replyCount > 0;
  const hasLastReplyAt = !!this.lastReplyAt;

  if (hasReplies !== hasLastReplyAt) {
    throw new ErrorHandler(
      "lastReplyAt is required when replyCount > 0, and must be null when replyCount is 0",
      EXCEPTION_CODES.INTERNAL_SERVER_ERROR,
    );
  }

  // isEdited / editedAt must move together
  if (this.isEdited !== !!this.editedAt) {
    throw new ErrorHandler(
      "editedAt is required when isEdited=true, and must be null when isEdited=false",
      EXCEPTION_CODES.INTERNAL_SERVER_ERROR,
    );
  }

  // dmSeenAt cannot precede dmDeliveredAt
  if (
    this.dmSeenAt &&
    this.dmDeliveredAt &&
    this.dmSeenAt < this.dmDeliveredAt
  ) {
    throw new ErrorHandler(
      "dmSeenAt cannot be earlier than dmDeliveredAt",
      EXCEPTION_CODES.INTERNAL_SERVER_ERROR,
    );
  }
});

// Primary feed — using _id as cursor (always indexed, no extra field needed)
messageSchema.index(
  { channelId: 1, _id: -1 },
  { partialFilterExpression: { deletedAt: null }, name: "channel_feed" },
);
messageSchema.index(
  { conversationId: 1, _id: -1 },
  { partialFilterExpression: { deletedAt: null }, name: "conversation_feed" },
);

// Thread replies
messageSchema.index(
  { threadId: 1, _id: 1 },
  { partialFilterExpression: { deletedAt: null, threadId: { $ne: null } } },
);

// Root messages that have threads (replyCount > 0 = has a thread):
messageSchema.index(
  { channelId: 1, replyCount: 1, _id: -1 },
  { partialFilterExpression: { threadId: null } }, // only root messages
);

// Mentions:
messageSchema.index({ mentions: 1, _id: -1 });

// Messages by sender
messageSchema.index(
  { senderId: 1, createdAt: -1 },
  { partialFilterExpression: { deletedAt: null }, name: "sender_feed" },
);

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
