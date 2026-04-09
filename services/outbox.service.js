import { TEMPLATE_TYPES } from "#models/notificationTemplate.model.js";
import { OutboxMessage } from "#models/outboxMessage.model.js";

const queueEmail = async (payload, createdBy) => {
  return OutboxMessage.create({
    type: TEMPLATE_TYPES.EMAIL,
    payload,
    createdBy,
    nextAttemptAt: new Date(),
  });
};

export const outboxService = { queueEmail };
