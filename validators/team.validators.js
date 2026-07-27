import { ORG_ROLES } from "#constants/roles.constants.js";
import { z } from "zod";
import {
  booleanQuery,
  pageNumber,
  pageSize,
  search,
} from "./common.validators.js";

const getTeamsSchema = z.object({
  query: z.object({
    search: search(),
    isArchived: booleanQuery("isArchived"),
    includePrivate: booleanQuery("includePrivate"),
    pageSize: pageSize(),
    pageNumber: pageNumber(),
  }),
});

const createTeamSchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: "Team name is required." })
      .trim()
      .min(1, "Team name cannot be empty.")
      .max(100, "Team name cannot exceed 100 characters."),

    description: z
      .string()
      .trim()
      .max(1024, "Description cannot exceed 1024 characters.")
      .optional()
      .nullable(),

    isPrivate: z
      .boolean({ invalid_type_error: "isPrivate must be a boolean." })
      .default(false),
  }),
});

const updateTeamSchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: "Team name is required." })
      .trim()
      .min(1, "Team name cannot be empty.")
      .max(100, "Team name cannot exceed 100 characters."),

    description: z
      .string()
      .trim()
      .max(1024, "Description cannot exceed 1024 characters.")
      .nullable()
      .optional(),
  }),
});

const addTeamMemberSchema = z.object({
  body: z.object({
    userId: z
      .string({ required_error: "User ID is required." })
      .min(1, "User ID cannot be empty."),

    role: z
      .string()
      .refine((val) => Object.values(ORG_ROLES).includes(val), {
        message: "Role is not valid.",
      })
      .default(ORG_ROLES.TeamMember)
      .optional(),
  }),
});

const updateTeamMemberRoleSchema = z.object({
  body: z.object({
    role: z
      .string({ required_error: "Role is required." })
      .refine((val) => Object.values(ORG_ROLES).includes(val), {
        message: "Role is not valid.",
      }),
  }),
});

export {
  getTeamsSchema,
  createTeamSchema,
  updateTeamSchema,
  addTeamMemberSchema,
  updateTeamMemberRoleSchema,
};
