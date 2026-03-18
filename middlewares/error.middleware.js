import multer from "multer";
import { sendResponse } from "../utils/sendResponse.util.js";

const globalErrorMiddleware = (err, req, res, next) => {
  // Multer errors
  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE: "File is too large.",
      LIMIT_FILE_COUNT: "Too many files uploaded at once.",
      LIMIT_UNEXPECTED_FILE: "Unexpected field name in form data.",
    };

    return sendResponse(
      res,
      400,
      err.code,
      messages[err.code] ?? "File upload error.",
    );
  }

  // Invalid file type (custom error from your validator)
  if (err?.code === "INVALID_FILE_TYPE") {
    return sendResponse(res, 415, err.code, err.message);
  }

  // MongoDB duplicate key error
  if (err.code === 11000) {
    err.statusCode = 400;
    err.message = `Duplicate value entered for ${Object.keys(err.keyValue)} field, please choose another value`;
    err.code = "DUPLICATE_KEY";
  }

  // Invalid ObjectId
  if (err.name === "CastError") {
    err.statusCode = 400;
    err.message = `Resource not found. Invalid: ${err.path}`;
    err.code = "INVALID_ID";
  }

  // Token errors
  if (err.name === "TokenExpiredError") {
    err.statusCode = 401;
    err.message = "Access token expired.";
  }

  if (err.name === "JsonWebTokenError") {
    err.statusCode = 401;
    err.message = "Invalid access token.";
  }

  // Default error
  err.message ||= "Internal Server Error";
  err.statusCode ||= 500;
  err.code ||= "INTERNAL_ERROR";

  return sendResponse(res, err.statusCode, err.code, err.message);
};

const TryCatch = (functionToWrap) => async (req, res, next) => {
  try {
    await functionToWrap(req, res, next);
  } catch (error) {
    next(error);
  }
};

export { globalErrorMiddleware, TryCatch };
