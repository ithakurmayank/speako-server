import { EXCEPTION_CODES } from "#constants/exceptionCodes.constants.js";
import { NotificationTemplate } from "#models/notificationTemplate.model.js";
import { ErrorHandler } from "#utils/errorHandler.util.js";

const renderTemplate = async (name, templateType, variables) => {
  const template = await NotificationTemplate.findOne({
    name,
    templateType,
    isActive: true,
  }).lean();

  if (!template) {
    throw new ErrorHandler(
      `Template not found: ${name}`,
      EXCEPTION_CODES.NOT_FOUND,
    );
  }

  const render = (str) =>
    str.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? "");

  return {
    subject: render(template.subjectText),
    html: render(template.bodyText),
  };
};

export const templateService = { renderTemplate };
