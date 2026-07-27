// authorize.middleware.js
import { EXCEPTION_CODES } from "../constants/exceptionCodes.constants.js";
import { hasPermission } from "../lib/hasPermission.lib.js";
import { ErrorHandler } from "../utils/errorHandler.util.js";

const authorize = (permission = null) => {
  return async (req, res, next) => {
    try {
      const pick = (key) =>
        req.params?.[key] ?? req.body?.[key] ?? req.query?.[key] ?? null;

      const context = {
        orgId: pick("orgId"),
        teamId: pick("teamId"),
        channelId: pick("channelId"),
        conversationId: pick("conversationId"),
      };

      req.context = context;

      // No permission passed -> route just needs context populated,
      // no actual authorization check required.
      if (!permission) {
        return next();
      }

      const allowed = await hasPermission(req.userId, permission, context);

      if (!allowed) {
        throw new ErrorHandler(
          "You do not have permission to perform this action.",
          EXCEPTION_CODES.INSUFFICIENT_PERMISSIONS,
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

export { authorize };
