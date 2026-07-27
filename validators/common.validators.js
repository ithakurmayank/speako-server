import { z } from "zod";

const pageSize = (defaultValue = 20) =>
  z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : defaultValue))
    .pipe(
      z
        .number()
        .int()
        .min(1, "pageSize must be at least 1.")
        .max(100, "pageSize cannot exceed 100."),
    );

const pageNumber = (defaultValue = 1) =>
  z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : defaultValue))
    .pipe(z.number().int().min(1, "pageNumber must be at least 1."));

const search = () => z.string().trim().optional();

const booleanQuery = (fieldName) =>
  z
    .enum(["true", "false"], {
      message: `${fieldName} must be 'true' or 'false'.`,
    })
    .optional();

const idQuery = (fieldName = "ID") =>
  z
    .string({
      required_error: `${fieldName} is required.`,
    })
    .min(1, `${fieldName} cannot be empty.`);

export { pageSize, pageNumber, search, booleanQuery, idQuery };
