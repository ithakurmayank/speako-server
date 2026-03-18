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
