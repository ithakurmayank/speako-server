import { EXCEPTION_CODES } from "../constants/exceptionCodes.constants.js";
import { hasPermission } from "../lib/hasPermission.lib.js";
import { ErrorHandler } from "../utils/errorHandler.util.js";

const authorize = (permission) => {
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

      const allowed = await hasPermission(req.userId, permission, context);

      if (!allowed) {
        throw new ErrorHandler(
          "You do not have permission to perform this action.",
          EXCEPTION_CODES.FORBIDDEN,
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

export { authorize };
