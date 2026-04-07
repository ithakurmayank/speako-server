import { EXCEPTION_CODES } from "#constants/exceptionCodes.constants.js";
import { ErrorHandler } from "#utils/errorHandler.util.js";
import env from "../configs/env.config.js";
import resend from "../configs/resend.config.js";

const sendEmail = async ({ to, subject, html }) => {
  try {
    const response = await resend.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject,
      html,
    });

    return response;
  } catch (error) {
    throw new ErrorHandler(
      "Failed to send email",
      EXCEPTION_CODES.INTERNAL_SERVER_ERROR,
    );
  }
};

export const emailService = { sendEmail };
