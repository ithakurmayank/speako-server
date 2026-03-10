import { env } from "../app.js";

const errorMiddleware = (err, req, res, next) => {
  err.message ||= "Internal Servor Error";
  err.statusCode ||= 500;

  if (err.code === 11000) {
    err.statusCode = 400;
    err.message = `Duplicate value entered for ${Object.keys(err.keyValue)} field, please choose another value`;
  }

  if (err.name === "CastError") {
    err.statusCode = 400;
    err.message = `Resource not found. Invalid: ${err.path}`;
    console.log("CAst Error");
  }
  return res.status(err.statusCode).json({
    success: false,
    message: err.message,
    // message: env === "development" ? err : err.message,
  });
};

const TryCatch = (functionToWrap) => async (req, res, next) => {
  try {
    await functionToWrap(req, res, next);
  } catch (error) {
    console.log("inside trycatch", error);
    next(error);
  }
};

export { errorMiddleware, TryCatch };
