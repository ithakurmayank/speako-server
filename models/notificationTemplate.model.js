import mongoose, { model, Schema } from "mongoose";

export const TEMPLATE_TYPES = {
  EMAIL: "Email",
  SMS: "Sms",
};

const notificationTemplateSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    templateType: { type: String, enum: TEMPLATE_TYPES, required: true },
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
