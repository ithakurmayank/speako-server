import { OUTBOX_CONFIG } from "#constants/common.constants.js";
import { TEMPLATE_TYPES } from "#models/notificationTemplate.model.js";
import { OutboxMessage } from "#models/outboxMessage.model.js";
import { emailService } from "#services/email.service.js";
import { templateService } from "#services/template.service.js";

const { MAX_RETRIES, POLL_INTERVAL_MS } = OUTBOX_CONFIG;

const processOutbox = async () => {
  const messages = await OutboxMessage.find({
    type: TEMPLATE_TYPES.EMAIL,
    isProcessed: false,
    isDeleted: false,
    nextAttemptAt: { $lte: new Date() },
  })
    .limit(10)
    .lean();

  for (const msg of messages) {
    try {
      const { to, templateName, variables } = msg.payload;

      const { subject, html } = await templateService.renderTemplate(
        templateName,
        TEMPLATE_TYPES.EMAIL,
        variables,
      );

      await emailService.sendEmail({ to, subject, html });

      await OutboxMessage.findByIdAndUpdate(msg._id, {
        isProcessed: true,
        processedAt: new Date(),
      });
    } catch (error) {
      const retryCount = msg.retryCount + 1;

      if (retryCount >= MAX_RETRIES) {
        await OutboxMessage.findByIdAndUpdate(msg._id, {
          retryCount,
          isDeleted: true,
        });
      } else {
        const backoffMs = Math.pow(3, retryCount) * 10000;

        await OutboxMessage.findByIdAndUpdate(msg._id, {
          retryCount,
          nextAttemptAt: new Date(Date.now() + backoffMs),
        });
      }
    }
  }
};

const startEmailWorker = () => {
  processOutbox();
  setInterval(processOutbox, POLL_INTERVAL_MS);
};

export { startEmailWorker };
