import { z } from "zod";
import { pageSize } from "./common.validators.js";
import {
  MESSAGE_MAX_ATTACHMENTS_COUNT,
  MESSAGE_MAX_CONTEXT_LENGTH,
} from "#constants/message.constants.js";

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
        .max(
          MESSAGE_MAX_CONTEXT_LENGTH,
          `Content cannot exceed ${MESSAGE_MAX_CONTEXT_LENGTH} characters.`,
        )
        .optional()
        .nullable(),

      fileIds: z
        .array(z.string())
        .max(
          MESSAGE_MAX_ATTACHMENTS_COUNT,
          `Content cannot exceed ${MESSAGE_MAX_ATTACHMENTS_COUNT} characters.`,
        )
        .default([]),

      mentionedUserIds: z.array(z.string()).default([]),
    })
    .refine(
      (data) => Boolean(data.content?.length) || data.fileIds.length > 0,
      {
        message: "A message must have content or at least one attachment.",
        path: ["content"],
      },
    )
    .refine((data) => new Set(data.fileIds).size === data.fileIds.length, {
      message: "FileIds must not contain duplicates.",
      path: ["fileIds"],
    })
    .refine(
      (data) =>
        new Set(data.mentionedUserIds).size === data.mentionedUserIds.length,
      {
        message: "MentionedUserIds must not contain duplicates.",
        path: ["mentionedUserIds"],
      },
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
        .max(
          MESSAGE_MAX_CONTEXT_LENGTH,
          `Content cannot exceed ${MESSAGE_MAX_CONTEXT_LENGTH} characters.`,
        )
        .optional()
        .nullable(),

      fileIds: z
        .array(z.string())
        .max(
          MESSAGE_MAX_ATTACHMENTS_COUNT,
          `Content cannot exceed ${MESSAGE_MAX_ATTACHMENTS_COUNT} characters.`,
        )
        .default([]),

      mentionedUserIds: z.array(z.string()).default([]),
    })
    .refine(
      (data) => Boolean(data.content?.length) || data.fileIds.length > 0,
      {
        message:
          "A message must have content or at least one attachment after editing.",
        path: ["content"],
      },
    )
    .refine((data) => new Set(data.fileIds).size === data.fileIds.length, {
      message: "FileIds must not contain duplicates.",
      path: ["fileIds"],
    })
    .refine(
      (data) =>
        new Set(data.mentionedUserIds).size === data.mentionedUserIds.length,
      {
        message: "MentionedUserIds must not contain duplicates.",
        path: ["mentionedUserIds"],
      },
    ),
});

export {
  getMessagesCommonSchema,
  sendMessageCommonSchema,
  toggleMessageReactionCommonSchema,
  editMessageCommonSchema,
};
