import mongoose, { model, Schema } from "mongoose";

const TEMPLATE_TYPES = Object.freeze({
  EMAIL: "Email",
  SMS: "Sms",
});

const TEMPLATE_TYPES_VALUES = Object.values(TEMPLATE_TYPES);

const NOTIFICATION_TEMPLATE_NAMES = {
  ORG_INVITATION_EMAIL: "Organization Invite - Email",
  ORG_INVITATION_SMS: "Organization Invite - Sms",
  PASSWORD_RESET_OTP_EMAIL: "Password Reset - Email",
};

const notificationTemplateSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    templateType: { type: String, enum: TEMPLATE_TYPES_VALUES, required: true },
    subjectText: { type: String, required: true, maxlength: 500 },
    bodyText: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

notificationTemplateSchema.index(
  { name: 1, templateType: 1 },
  { unique: true },
);
notificationTemplateSchema.index({ templateType: 1 });

export const NotificationTemplate =
  mongoose.models.NotificationTemplate ||
  model("NotificationTemplate", notificationTemplateSchema);

export { TEMPLATE_TYPES, TEMPLATE_TYPES_VALUES, NOTIFICATION_TEMPLATE_NAMES };
