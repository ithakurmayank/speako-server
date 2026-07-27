/**
 * @param {import("express").Response} res
 * @param {number} statusCode
 * @param {string | null} exceptionCode
 * @param {string} statusMessage
 * @param {any} [result=null]
 */
const sendResponse = (
  res,
  statusCode,
  exceptionCode,
  statusMessage,
  result = null,
) =>
  res.status(statusCode).json({
    statusCode,
    exceptionCode,
    statusMessage,
    result,
  });

export { sendResponse };
