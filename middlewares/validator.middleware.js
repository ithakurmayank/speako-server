import { validationResult } from "express-validator";
import { ErrorHandler } from "../utils/utility";

const validateHandler = (req, res, next) => {
  const errors = validationResult(req);

  if (errors.isEmpty()) return next();

  const errorMessages = errors
    .array()
    .map((err) => err.msg)
    .join(", ");

  next(new ErrorHandler(errorMessages, 400));
};

export { validateHandler };
