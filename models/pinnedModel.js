import mongoose, { model, Schema, Types } from "mongoose";

const { ObjectId } = Types;

const pinnedMessageSchema = new Schema(
  {
    messageId: { type: ObjectId, ref: "Message", required: true },
    pinnedBy: { type: ObjectId, ref: "User", required: true },

    // Exactly ONE set:
    channelId: { type: ObjectId, ref: "Channel", default: null },
    conversationId: { type: ObjectId, ref: "Conversation", default: null },

    contentSnapshot: { type: String, default: null, maxlength: 500 },
    pinnedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

pinnedMessageSchema.index({ channelId: 1, pinnedAt: -1 });
pinnedMessageSchema.index({ conversationId: 1, pinnedAt: -1 });
// Prevents duplication
pinnedMessageSchema.index(
  { messageId: 1, channelId: 1 },
  { unique: true, sparse: true },
);
// Prevents duplication
pinnedMessageSchema.index(
  { messageId: 1, conversationId: 1 },
  { unique: true, sparse: true },
);

export const PinnedMessage =
  mongoose.models.PinnedMessage || model("PinnedMessage", pinnedMessageSchema);
