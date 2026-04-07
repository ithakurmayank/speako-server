import mongoose, { model, Schema, Types } from "mongoose";

const { ObjectId } = Types;

const outboxMessageSchema = new Schema(
  {
    type: { type: String, required: true, maxlength: 200 },
    payload: { type: Schema.Types.Mixed, required: true },
    retryCount: { type: Number, default: 0 },
    createdBy: { type: ObjectId, ref: "User", default: null },
    isProcessed: { type: Boolean, default: false },
    processedAt: { type: Date, default: null },
    nextAttemptAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

outboxMessageSchema.index(
  { isProcessed: 1, nextAttemptAt: 1 },
  { partialFilterExpression: { isDeleted: false } },
);

export const OutboxMessage =
  mongoose.models.OutboxMessage || model("OutboxMessage", outboxMessageSchema);
