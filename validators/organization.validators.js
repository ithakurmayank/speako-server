import { ALL_ROLES_VALUES } from "#constants/roles.constants.js";
import { isEmailValid } from "#utils/regex.util.js";
import { z } from "zod";

const createOrgInvitationSchema = z.object({
  body: z.object({
    role: z
      .string({ required_error: "Role is required." })
      .min(1, "Role cannot be empty.")
      .refine(
        (value) => {
          const ORG_ROLES = ALL_ROLES_VALUES.filter((role) =>
            role.toLowerCase().includes("org"),
          );
          return ORG_ROLES.includes(value);
        },
        { message: "Role is not valid" },
      ),

    email: z
      .string({ required_error: "Email is required." })
      .min(1, "Email cannot be empty.")
      .refine(isEmailValid, { message: "Invalid email." }),
  }),
});

export { createOrgInvitationSchema };
