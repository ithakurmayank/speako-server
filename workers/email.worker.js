import { OUTBOX_CONFIG } from "#constants/notifications.constants.js";
import { OutboxMessage } from "#models/outboxMessage.model.js";
import { emailService } from "#services/email.service.js";
import { templateService } from "#services/template.service.js";

const { MAX_RETRIES, POLL_INTERVAL_MS } = OUTBOX_CONFIG;

const processOutbox = async () => {
  const messages = await OutboxMessage.find({
    isProcessed: false,
    isDeleted: false,
    nextAttemptAt: { $lte: new Date() },
  })
    .limit(10)
    .lean();

  for (const msg of messages) {
    try {
      const { to, templateName, templateType, variables } = msg.payload;

      const { subject, html } = await templateService.renderTemplate(
        templateName,
        templateType,
        variables,
      );

      const response = await emailService.sendEmail({ to, subject, html });

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
