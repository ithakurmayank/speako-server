import { FLAT_ERROR_DEFINITIONS } from "../constants/exceptionCodes.constants.js";

class ErrorHandler extends Error {
  constructor(message, exceptionCode = "INTERNAL_SERVER_ERROR") {
    super(message);

    const errorDef = FLAT_ERROR_DEFINITIONS[exceptionCode];

    this.code = exceptionCode;
    this.statusCode = errorDef?.status || 500;
  }
}

/**
 * @callback AsyncHandler
 * @param {import("#types/express.js").Request} req
 * @param {import("#types/express.js").Response} res
 * @param {import("#types/express.js").NextFunction} next
 * @returns {Promise<any>}
 */

/**
 * @param {AsyncHandler} functionToWrap
 * @returns {AsyncHandler}
 */
const TryCatch = (functionToWrap) => async (req, res, next) => {
  try {
    await functionToWrap(req, res, next);
  } catch (error) {
    console.log("Error from TryCatch Block: ", error);
    next(error);
  }
};

export { ErrorHandler, TryCatch };
