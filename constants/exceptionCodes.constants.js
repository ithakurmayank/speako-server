const ERROR_DEFINITIONS = {
  AUTH: {
    INVALID_CREDENTIALS: { code: "INVALID_CREDENTIALS", status: 401 },
    AUTH_REQUIRED: { code: "AUTH_REQUIRED", status: 401 },
    INVALID_TOKEN: { code: "INVALID_TOKEN", status: 401 },
    TOKEN_EXPIRED: { code: "TOKEN_EXPIRED", status: 401 },
    REVOKED_REFRESH_TOKEN: { code: "REVOKED_REFRESH_TOKEN", status: 401 },
    SESSION_EXPIRED: { code: "SESSION_EXPIRED", status: 401 },
  },

  AUTHORIZATION: {
    FORBIDDEN: { code: "FORBIDDEN", status: 403 },
    INSUFFICIENT_PERMISSIONS: {
      code: "INSUFFICIENT_PERMISSIONS",
      status: 403,
    },
  },

  RESOURCE: {
    RESOURCE_NOT_FOUND: { code: "RESOURCE_NOT_FOUND", status: 404 },
    DUPLICATE_RESOURCE: { code: "DUPLICATE_RESOURCE", status: 409 },
    RESOURCE_CONFLICT: { code: "RESOURCE_CONFLICT", status: 409 },
  },

  VALIDATION: {
    VALIDATION_ERROR: { code: "VALIDATION_ERROR", status: 400 },
    INVALID_INPUT: { code: "INVALID_INPUT", status: 400 },
    MISSING_REQUIRED_FIELDS: {
      code: "MISSING_REQUIRED_FIELDS",
      status: 400,
    },
    INVALID_QUERY_PARAMS: {
      code: "INVALID_QUERY_PARAMS",
      status: 400,
    },
  },

  REQUEST: {
    ROUTE_NOT_FOUND: { code: "ROUTE_NOT_FOUND", status: 404 },
    METHOD_NOT_ALLOWED: { code: "METHOD_NOT_ALLOWED", status: 405 },
    BAD_REQUEST: { code: "BAD_REQUEST", status: 400 },
  },

  SERVER: {
    INTERNAL_SERVER_ERROR: {
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
    },
    SERVICE_UNAVAILABLE: {
      code: "SERVICE_UNAVAILABLE",
      status: 503,
    },
    TIMEOUT: { code: "TIMEOUT", status: 504 },
  },

  FILE: {
    FILE_UPLOAD_FAILED: {
      code: "FILE_UPLOAD_FAILED",
      status: 500,
    },
    INVALID_FILE_TYPE: {
      code: "INVALID_FILE_TYPE",
      status: 400,
    },
    FILE_TOO_LARGE: { code: "FILE_TOO_LARGE", status: 413 },
    FILE_DELETE_FAILED: {
      code: "FILE_DELETE_FAILED",
      status: 500,
    },
  },

  CHAT: {
    MESSAGE_SEND_FAILED: {
      code: "MESSAGE_SEND_FAILED",
      status: 500,
    },
    CHAT_NOT_FOUND: { code: "CHAT_NOT_FOUND", status: 404 },
    USER_NOT_IN_CHAT: { code: "USER_NOT_IN_CHAT", status: 403 },
  },

  SECURITY: {
    TOO_MANY_REQUESTS: {
      code: "TOO_MANY_REQUESTS",
      status: 429,
    },
    SUSPICIOUS_ACTIVITY: {
      code: "SUSPICIOUS_ACTIVITY",
      status: 403,
    },
  },
};

const TYPED_ERROR_DEFINITIONS = /** @type {typeof ERROR_DEFINITIONS} */ (
  ERROR_DEFINITIONS
);

Object.freeze(TYPED_ERROR_DEFINITIONS);

const FLAT_ERROR_DEFINITIONS = Object.fromEntries(
  Object.values(TYPED_ERROR_DEFINITIONS).flatMap((group) =>
    Object.values(group).map((exception) => [exception.code, exception]),
  ),
);

Object.freeze(FLAT_ERROR_DEFINITIONS);

const EXCEPTION_CODES = Object.fromEntries(
  Object.values(TYPED_ERROR_DEFINITIONS).flatMap((group) =>
    Object.entries(group).map(([key, value]) => [key, value.code]),
  ),
);

Object.freeze(EXCEPTION_CODES);

export { FLAT_ERROR_DEFINITIONS, EXCEPTION_CODES };
