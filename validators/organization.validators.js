import { ALL_ROLES_VALUES, ORG_ROLES } from "#constants/roles.constants.js";
import { isEmailValid, orgSlugRegex } from "#utils/regex.util.js";
import { z } from "zod";

const getOrganizationMembersSchema = z.object({
  params: z.object({
    orgId: z
      .string({ required_error: "Organization ID is required." })
      .min(1, "Organization ID cannot be empty."),
    userId: z
      .string({ required_error: "User ID is required." })
      .min(1, "User ID cannot be empty."),
  }),
  query: z.object({
    search: z.string().optional(),
    role: z.string().optional(),
    pageNumber: z.string().optional(),
    pageSize: z.string().optional(),
  }),
});

const createOrganizationSchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: "Organization name is required." })
      .min(1, "Organization name cannot be empty.")
      .max(100, "Organization name cannot exceed 100 characters.")
      .trim(),

    slug: z
      .string({ required_error: "Organization slug is required." })
      .min(2, "Slug must be at least 2 characters.")
      .max(48, "Slug cannot exceed 48 characters.")
      .refine((val) => !val.startsWith("-") && !val.endsWith("-"), {
        message: "Slug cannot start or end with a hyphen.",
      })
      .regex(
        orgSlugRegex,
        "Slug can only contain lowercase letters, numbers, and hyphens.",
      ),
  }),
});

const updateOrganizationSchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: "Organization name is required." })
      .min(1, "Organization name cannot be empty.")
      .max(100, "Organization name cannot exceed 100 characters.")
      .trim(),
  }),
});

const createOrgInvitationSchema = z.object({
  body: z.object({
    role: z
      .string({ required_error: "Role is required." })
      .min(1, "Role cannot be empty.")
      .refine(
        (value) => {
          const ORG_ROLES_ONLY = ALL_ROLES_VALUES.filter((role) =>
            role.toLowerCase().includes("org"),
          );
          return ORG_ROLES_ONLY.includes(value);
        },
        { message: "Role is not valid" },
      ),

    email: z
      .string({ required_error: "Email is required." })
      .min(1, "Email cannot be empty.")
      .refine(isEmailValid, { message: "Invalid email." }),
  }),
});

const addMemberToOrganizationSchema = z.object({
  body: z.object({
    role: z
      .string({ required_error: "Role is required." })
      .min(1, "Role cannot be empty.")
      .refine(
        (value) => {
          const isValidRole = [
            ORG_ROLES.OrgAdmin,
            ORG_ROLES.OrgMember,
            ORG_ROLES.OrgGuest,
          ].includes(value);
          return isValidRole;
        },
        { message: "Role is not valid" },
      ),

    invitedUserId: z
      .string({ required_error: "Invited user ID is required." })
      .min(1, "Invited user ID cannot be empty."),
  }),
});

const updateOrganizationMemberRoleSchema = z.object({
  body: z.object({
    role: z
      .string({ required_error: "Role is required." })
      .min(1, "Role cannot be empty.")
      .refine(
        (value) => {
          const isValidRole = [
            ORG_ROLES.OrgAdmin,
            ORG_ROLES.OrgMember,
            ORG_ROLES.OrgGuest,
          ].includes(value);
          return isValidRole;
        },
        { message: "Role is not valid" },
      ),

    userId: z
      .string({ required_error: "User ID is required." })
      .min(1, "Invited user ID cannot be empty."),
  }),
  params: z.object({
    orgId: z
      .string({ required_error: "Membership ID is required." })
      .min(1, "Invited user ID cannot be empty."),

    membershipId: z
      .string({ required_error: "Membership ID is required." })
      .min(1, "Invited user ID cannot be empty."),
  }),
});

export {
  getOrganizationMembersSchema,
  createOrganizationSchema,
  updateOrganizationSchema,
  createOrgInvitationSchema,
  addMemberToOrganizationSchema,
  updateOrganizationMemberRoleSchema,
};
