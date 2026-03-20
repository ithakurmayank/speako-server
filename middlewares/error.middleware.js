import multer from "multer";
import { sendResponse } from "../utils/sendResponse.util.js";
import { ZodError } from "zod";
import { EXCEPTION_CODES } from "../constants/exceptionCodes.constants.js";
import { ErrorHandler } from "../utils/errorHandler.util.js";

const globalErrorMiddleware = (err, req, res, next) => {
  // Multer errors
  if (err instanceof multer.MulterError) {
    let error;

    switch (err.code) {
      case "LIMIT_FILE_SIZE":
        error = new ErrorHandler(
          "File is too large.",
          EXCEPTION_CODES.FILE_TOO_LARGE,
        );
        break;

      case "LIMIT_FILE_COUNT":
      case "LIMIT_UNEXPECTED_FILE":
        error = new ErrorHandler(
          "Invalid file upload.",
          EXCEPTION_CODES.FILE_UPLOAD_FAILED,
        );
        break;

      default:
        error = new ErrorHandler(
          "File upload error.",
          EXCEPTION_CODES.FILE_UPLOAD_FAILED,
        );
    }

    return sendResponse(res, error.statusCode, error.code, error.message);
  }

  // MongoDB duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue).join(", ");

    const error = new ErrorHandler(
      `Duplicate value for ${field}`,
      EXCEPTION_CODES.DUPLICATE_RESOURCE,
    );

    return sendResponse(res, error.statusCode, error.code, error.message);
  }

  // Invalid ObjectId
  if (err.name === "CastError") {
    const error = new ErrorHandler(
      `Invalid ${err.path}`,
      EXCEPTION_CODES.INVALID_INPUT,
    );

    return sendResponse(res, error.statusCode, error.code, error.message);
  }

  // Token errors
  if (err.name === "TokenExpiredError") {
    const error = new ErrorHandler(
      "Access token expired.",
      EXCEPTION_CODES.TOKEN_EXPIRED,
    );

    return sendResponse(res, error.statusCode, error.code, error.message);
  }

  if (err.name === "JsonWebTokenError") {
    const error = new ErrorHandler(
      "Invalid access token.",
      EXCEPTION_CODES.INVALID_TOKEN,
    );

    return sendResponse(res, error.statusCode, error.code, error.message);
  }

  // Zod validation
  if (err instanceof ZodError) {
    const errorMap = new Map();

    //if a field has multiple errors, set only the first error
    for (const e of err.issues) {
      const field = e.path.slice(1).join(".");

      if (!errorMap.has(field)) {
        errorMap.set(field, {
          field,
          message: e.message,
        });
      }
    }

    const formattedErrors = Array.from(errorMap.values());

    const error = new ErrorHandler(
      "Validation failed",
      EXCEPTION_CODES.VALIDATION_ERROR,
    );

    return sendResponse(res, error.statusCode, error.code, error.message, {
      errors: formattedErrors,
    });
  }

  // If already an ErrorHandler, use it directly
  if (err instanceof ErrorHandler) {
    return sendResponse(res, err.statusCode, err.code, err.message);
  }

  // Fallback (unknown error)
  const error = new ErrorHandler(
    err.message || "Internal Server Error",
    EXCEPTION_CODES.INTERNAL_SERVER_ERROR,
  );

  return sendResponse(res, error.statusCode, error.code, error.message);
};

export { globalErrorMiddleware };
