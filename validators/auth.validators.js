import { z } from "zod";
import { isEmail, isUsername } from "../utils/regex.util.js";

const loginSchema = z.object({
  body: z.object({
    identifier: z
      .string({ required_error: "Username or Email is required." })
      .min(1, "Username or Email cannot be empty.")
      .refine((value) => {
        const isValidEmail = isEmail(value);

        const isValidUsername = isUsername(value); // adjust as per your rules

        return isValidEmail || isValidUsername;
      }, "Must be a valid email or username."),

    password: z
      .string({ required_error: "Password is required." })
      .min(1, "Password cannot be empty."),
  }),
});

export { loginSchema };
