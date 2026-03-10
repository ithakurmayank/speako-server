import mongoose, { model, Schema, Types } from "mongoose";

const { ObjectId } = Types;

// Fan-out on write: one document per recipient per event.
// Regular channel messages do NOT create notification docs — ReadState handles those.
// Creates notifications for: mentions, thread replies, reactions, DMs,
const notificationSchema = new Schema(
  {
    recipientId: { type: ObjectId, ref: "User", required: true },
    actorId: { type: ObjectId, ref: "User", default: null }, // who triggered it

    type: {
      type: String,
      enum: [
        "mention",
        "thread_reply",
        "reaction",
        "dm",
        "group_message",
        "added_to_team",
        "added_to_channel",
        "added_to_group",
      ],
      required: true,
    },

    // What triggered it:
    messageId: { type: ObjectId, ref: "Message", default: null },
    channelId: { type: ObjectId, ref: "Channel", default: null },
    conversationId: { type: ObjectId, ref: "Conversation", default: null },
    teamId: { type: ObjectId, ref: "Team", default: null },

    preview: { type: String, default: null, maxlength: 256 }, // truncated message preview

    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 }); // unread notifications
notificationSchema.index({ recipientId: 1, createdAt: -1 }); // full history
// Auto-delete read notifications after 30 days:
notificationSchema.index(
  { readAt: 1 },
  {
    expireAfterSeconds: 30 * 24 * 60 * 60,
    partialFilterExpression: { isRead: true },
    name: "ttl_read_notifications",
  },
);
export const Notification =
  mongoose.models.Notification || model("Notification", notificationSchema);
