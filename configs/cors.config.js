import { EXCEPTION_CODES } from "../constants/exceptionCodes.constants.js";
import { ErrorHandler } from "../utils/errorHandler.util.js";
import env from "./env.config.js";

const allowedOrigins = env.CLIENT_ORIGIN.split(",");

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    const isExactMatch = allowedOrigins.includes(origin);

    // TODO : Remove this when deploying
    const isLovablePreview = origin.endsWith(".lovable.app");

    if (isExactMatch || isLovablePreview) {
      callback(null, true);
    } else {
      callback(
        new ErrorHandler("Not allowed by CORS", EXCEPTION_CODES.FORBIDDEN),
      );
    }
  },
  credentials: true,
};

export { corsOptions };
