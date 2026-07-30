import { z } from "zod";
import { pageSize } from "./common.validators.js";

const getMessagesCommonSchema = z.object({
  query: z.object({
    pageSize: pageSize(50),

    beforeId: z.string().optional(),

    threadRootMessageId: z.string().optional(),
  }),
});

const sendMessageCommonSchema = z.object({
  body: z
    .object({
      clientMessageId: z
        .string({ required_error: "clientMessageId is required." })
        .min(1, "clientMessageId cannot be empty."),

      content: z
        .string()
        .trim()
        .max(10000, "Content cannot exceed 10000 characters.")
        .optional()
        .nullable(),

      fileIds: z.array(z.string()).default([]).optional(),

      mentionedUserIds: z.array(z.string()).default([]).optional(),

      threadRootMessageId: z.string().optional().nullable(),
    })
    .refine(
      (data) => {
        const hasContent = data.content?.trim().length > 0;
        const hasFiles = (data.fileIds ?? []).length > 0;
        return hasContent || hasFiles;
      },
      { message: "Message must contain text or at least one attachment." },
    ),
});

const toggleMessageReactionCommonSchema = z.object({
  body: z.object({
    emoji: z
      .string({ required_error: "Emoji is required." })
      .trim()
      .min(1, "Emoji cannot be empty.")
      .max(100, "Emoji is too long."),
  }),
});

const editMessageCommonSchema = z.object({
  body: z
    .object({
      content: z
        .string()
        .trim()
        .max(10000, "Content cannot exceed 10000 characters.")
        .optional(),

      fileIds: z.array(z.string()).default([]),

      mentionedUserIds: z.array(z.string()).default([]),
    })
    .refine(
      (data) =>
        (data.content?.trim().length ?? 0) > 0 || data.fileIds.length > 0,
      {
        message: "Message must contain text or at least one attachment.",
        path: ["content"],
      },
    ),
});

export {
  getMessagesCommonSchema,
  sendMessageCommonSchema,
  toggleMessageReactionCommonSchema,
  editMessageCommonSchema,
};
