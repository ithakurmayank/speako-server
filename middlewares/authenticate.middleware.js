import { EXCEPTION_CODES } from "../constants/exceptionCodes.constants.js";
import { ErrorHandler } from "../utils/errorHandler.util.js";
import { verifyAccessToken } from "../utils/token.util.js";
import { TryCatch } from "./error.middleware.js";

const authenticate = TryCatch(async (req, res, next) => {
  const token = req.cookies?.accessToken;

  if (!token) {
    throw new ErrorHandler("Not authenticated.", EXCEPTION_CODES.AUTH_REQUIRED);
  }

  const payload = verifyAccessToken(token);
  req.userId = payload.sub;

  next();
});

export { authenticate };
