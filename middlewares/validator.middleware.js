import { validationResult } from "express-validator";
import { ErrorHandler } from "../utils/errorHandler.util.js";
import { EXCEPTION_CODES } from "../constants/exceptionCodes.constants.js";

const validateHandler = (req, res, next) => {
  const errors = validationResult(req);

  if (errors.isEmpty()) return next();

  const errorMessages = errors
    .array()
    .map((err) => err.msg)
    .join(", ");

  next(new ErrorHandler(errorMessages, EXCEPTION_CODES.INVALID_INPUT));
};

export { validateHandler };
