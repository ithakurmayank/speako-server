import { FLAT_ERROR_DEFINITIONS } from "../constants/exceptionCodes.constants.js";

class ErrorHandler extends Error {
  constructor(message, exceptionCode = "INTERNAL_SERVER_ERROR") {
    super(message);

    const errorDef = FLAT_ERROR_DEFINITIONS[exceptionCode];

    this.code = exceptionCode;
    this.statusCode = errorDef?.status || 500;
  }
}

const TryCatch = (functionToWrap) => async (req, res, next) => {
  try {
    await functionToWrap(req, res, next);
  } catch (error) {
    next(error);
  }
};

export { ErrorHandler, TryCatch };
