import { OUTBOX_MESSAGE_TYPES } from "#constants/common.constants.js";
import { OutboxMessage } from "#models/outboxMessage.model.js";

const queueEmail = async (payload, createdBy) => {
  return OutboxMessage.create({
    type: OUTBOX_MESSAGE_TYPES.EMAIL_PAYLOAD,
    payload,
    createdBy,
    nextAttemptAt: new Date(),
  });
};

export const outboxService = { queueEmail };
