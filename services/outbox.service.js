import { OutboxMessage } from "#models/outboxMessage.model.js";

const queueEmail = async (type, payload, createdBy) => {
  return OutboxMessage.create({
    type,
    payload,
    createdBy,
    nextAttemptAt: new Date(),
  });
};

export const outboxService = { queueEmail };
