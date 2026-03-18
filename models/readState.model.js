import mongoose, { model, Schema, Types } from "mongoose";

const { ObjectId } = Types;

const readStateSchema = new Schema(
  {
    userId: { type: ObjectId, ref: "User", required: true },

    // Exactly ONE set:
    channelId: { type: ObjectId, ref: "Channel", default: null },
    conversationId: { type: ObjectId, ref: "Conversation", default: null },

    lastReadMessageId: { type: ObjectId, ref: "Message", default: null },
    lastReadAt: { type: Date, default: null },

    unreadCount: { type: Number, default: 0, min: 0 },
    mentionCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

readStateSchema.index(
  { userId: 1, channelId: 1 },
  { unique: true, sparse: true },
);
readStateSchema.index(
  { userId: 1, conversationId: 1 },
  { unique: true, sparse: true },
);
readStateSchema.index({ userId: 1 }); // load all unread states for sidebar
readStateSchema.index({ channelId: 1, unreadCount: 1 }); // push notification targeting

export const ReadState =
  mongoose.models.ReadState || model("ReadState", readStateSchema);
