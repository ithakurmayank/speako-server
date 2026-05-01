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
      .min(1, "Name cannot be empty.")
      .max(64, "Name cannot exceed 64 characters.")
      .trim(),

    username: z
      .string({ required_error: "Username is required." })
      .min(1, "Username cannot be empty.")
      .refine(isUsernameValid, { message: "Username is not valid." }),

    email: z
      .string({ required_error: "Email is required." })
      .min(1, "Email cannot be empty.")
      .refine(isEmailValid, { message: "Invalid email." }),

    password: z
      .string({ required_error: "Password is required." })
      .refine(isPasswordValid, { message: "Password is not valid." }),

    inviteToken: z
      .string()
      .min(1, { message: "Invite token cannot be empty." })
      .optional(),
  }),
});

const forgotPasswordSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: "Email is required." })
      .min(1, "Email cannot be empty.")
      .refine(isEmailValid, { message: "Invalid email." }),
  }),
});

const resetPasswordSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: "Email is required." })
      .min(1, "Email cannot be empty.")
      .refine(isEmailValid, { message: "Invalid email." }),

    otp: z
      .string({ required_error: "OTP is required." })
      .min(1, "OTP is required.")
      .length(6, "OTP must be exactly 6 digits.")
      .regex(/^\d+$/, "OTP must contain digits only."),

    newPassword: z
      .string({ required_error: "Password is required." })
      .refine(isPasswordValid, { message: "Password is not valid." }),
  }),
});

const changePasswordSchema = z.object({
  body: z.object({
    newPassword: z
      .string({ required_error: "Password is required." })
      .refine(isPasswordValid, { message: "Password is not valid." }),

    currentPassword: z
      .string({ required_error: "Password is required." })
      .refine(isPasswordValid, { message: "Password is not valid." }),
  }),
});

const verifyUserEmailSchema = z.object({
  body: z.object({
    otp: z
      .string({ required_error: "OTP is required." })
      .min(1, "OTP is required.")
      .length(6, "OTP must be exactly 6 digits.")
      .regex(/^\d+$/, "OTP must contain digits only."),
  }),
});

export {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  verifyUserEmailSchema,
};
