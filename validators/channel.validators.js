import { CHANNEL_TYPES } from "#constants/channel.constants.js";
import { z } from "zod";

const createChannelSchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: "Channel name is required." })
      .trim()
      .min(1, "Channel name cannot be empty.")
      .max(100, "Channel name cannot exceed 100 characters."),

    description: z
      .string()
      .trim()
      .max(500, "Description cannot exceed 500 characters.")
      .optional()
      .nullable(),

    type: z
      .string()
      .refine((val) => Object.values(CHANNEL_TYPES).includes(val), {
        message: "Invalid channel type.",
      })
      .default(CHANNEL_TYPES.TEXT)
      .optional(),

    isPrivate: z
      .boolean({ invalid_type_error: "isPrivate must be a boolean." })
      .default(false)
      .optional(),
  }),
});

const updateChannelSchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: "Channel name is required." })
      .trim()
      .min(1, "Channel name cannot be empty.")
      .max(100, "Channel name cannot exceed 100 characters."),

    description: z
      .string()
      .trim()
      .max(500, "Description cannot exceed 500 characters.")
      .nullable()
      .optional(),
  }),
});

export { createChannelSchema, updateChannelSchema };
