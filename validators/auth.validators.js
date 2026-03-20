import { z } from "zod";
import {
  isEmailValid,
  isPasswordValid,
  isUsernameValid,
} from "../utils/regex.util.js";

const loginSchema = z.object({
  body: z.object({
    identifier: z
      .string({ required_error: "Username or Email is required." })
      .min(1, "Username or Email cannot be empty.")
      .refine(
        (value) => {
          const isEmail = isEmailValid(value);

          const isUsername = isUsernameValid(value);

          return isEmail || isUsername;
        },
        { message: "Must be a valid email or username." },
      ),

    password: z
      .string({ required_error: "Password is required." })
      .min(1, "Password cannot be empty."),
  }),
});

const registerSchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: "Name is required." })
      .min(1, "Name cannot be empty."),

    username: z
      .string({ required_error: "Username is required." })
      .min(1, "Username cannot be empty.")
      .refine((value) => isUsernameValid(value), {
        message: "Username is not valid",
      }),

    email: z
      .string({ required_error: "Email is required." })
      .min(1, "Email cannot be empty.")
      .refine((val) => isEmailValid(val), { message: "Invalid email" }),

    password: z
      .string({ required_error: "Password is required." })
      .refine((val) => isPasswordValid(val), {
        message: "Password is not valid.",
      }),
  }),
});

export { loginSchema, registerSchema };
