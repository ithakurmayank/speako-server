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

const getChannelsSchema = z.object({
  query: z.object({
    search: z.string().trim().optional(),

    isArchived: z
      .enum(["true", "false"], {
        message: "isArchived must be 'true' or 'false'.",
      })
      .optional(),

    includePrivate: z
      .enum(["true", "false"], {
        message: "includePrivate must be 'true' or 'false'.",
      })
      .optional(),

    pageSize: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val) : 20))
      .pipe(
        z
          .number()
          .int()
          .min(1, "pageSize must be at least 1.")
          .max(100, "pageSize cannot exceed 100."),
      ),

    pageNumber: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val) : 1))
      .pipe(z.number().int().min(1, "pageNumber must be at least 1.")),
  }),
});

const addChannelMemberSchema = z.object({
  body: z.object({
    userId: z
      .string({ required_error: "User ID is required." })
      .min(1, "User ID cannot be empty."),

    role: z
      .string()
      .refine((val) => Object.values(CHANNEL_ROLES).includes(val), {
        message: "Role is not valid.",
      })
      .default(CHANNEL_ROLES.ChannelMember)
      .optional(),
  }),
});

const updateChannelMemberRoleSchema = z.object({
  body: z.object({
    role: z
      .string({ required_error: "Role is required." })
      .refine((val) => Object.values(CHANNEL_ROLES).includes(val), {
        message: "Role is not valid.",
      }),
  }),
});

const getChannelMembersSchema = z.object({
  query: z.object({
    pageSize: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val) : 20))
      .pipe(
        z
          .number()
          .int()
          .min(1, "pageSize must be at least 1.")
          .max(100, "pageSize cannot exceed 100."),
      ),

    pageNumber: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val) : 1))
      .pipe(z.number().int().min(1, "pageNumber must be at least 1.")),
  }),
});

export {
  createChannelSchema,
  updateChannelSchema,
  getChannelsSchema,
  addChannelMemberSchema,
  updateChannelMemberRoleSchema,
  getChannelMembersSchema,
};
