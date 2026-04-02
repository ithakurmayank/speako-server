import { z } from "zod";

const updateProfileSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, "Name cannot be empty.")
      .max(64, "Name cannot exceed 64 characters.")
      .trim()
      .optional(),

    bio: z
      .string()
      .min(1, "Name cannot be empty.")
      .max(300, "Name cannot exceed 64 characters.")
      .trim()
      .optional(),
  }),
});

export { updateProfileSchema };
