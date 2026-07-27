import { z } from "zod";
import { idQuery, pageNumber, pageSize } from "./common.validators.js";

const getConversationsSchema = z.object({
  query: z.object({
    pageSize: pageSize(),
    pageNumber: pageNumber(),
  }),
});

const lookupDirectConversationSchema = z.object({
  query: z.object({
    userId: z
      .string({ required_error: "User ID is required." })
      .min(1, "User ID cannot be empty."),
  }),
});

const createDirectConversationSchema = z.object({
  body: z.object({
    targetUserId: z
      .string({ required_error: "Target user ID is required." })
      .min(1, "Target user ID cannot be empty."),
  }),
});

const createGroupConversationSchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: "Group name is required." })
      .trim()
      .min(1, "Group name cannot be empty.")
      .max(150, "Group name cannot exceed 150 characters."),

    participantUserIds: z
      .array(
        z
          .string({ required_error: "Participant user ID is required." })
          .min(1, "Participant user ID cannot be empty."),
        { required_error: "Participant user IDs are required." },
      )
      .min(2, "A group conversation requires at least 2 other participants."),
  }),
});

const updateGroupConversationSchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: "Group name is required." })
      .trim()
      .min(1, "Group name cannot be empty.")
      .max(150, "Group name cannot exceed 150 characters."),
  }),
});

const getParticipantsSchema = z.object({
  query: z.object({
    pageSize: pageSize(),
    pageNumber: pageNumber(),
  }),
});

const addParticipantSchema = z.object({
  body: z.object({
    userId: idQuery("User ID"),
  }),
});

const updateParticipantRoleSchema = z.object({
  body: z.object({
    role: z
      .string({ required_error: "Role is required." })
      .refine((val) => Object.values(GROUP_ROLES).includes(val), {
        message: "Role is not valid.",
      }),
  }),
});

export {
  getConversationsSchema,
  lookupDirectConversationSchema,
  createDirectConversationSchema,
  createGroupConversationSchema,
  updateGroupConversationSchema,
  getParticipantsSchema,
  addParticipantSchema,
  updateParticipantRoleSchema,
};
