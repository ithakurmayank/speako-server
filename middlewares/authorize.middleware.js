import { EXCEPTION_CODES } from "../constants/exceptionCodes.constants.js";
import { hasPermission } from "../lib/hasPermission.lib.js";
import { ErrorHandler } from "../utils/errorHandler.util.js";

/**
 * Express middleware factory.
 *
 * @param {string} permission   — from PERMISSIONS constants
 * @param {Function} getContext — receives req, returns { orgId?, teamId?, channelId? conversationId? }
 *
 * Usage:
 *   router.post('/messages', authenticate, authorize(P.MESSAGE_SEND, req => ({
 *     orgId: req.org.id,
 *     teamId:         req.team.id,
 *     channelId:      req.params.channelId,
 *     conversationId:      req.params.conversationId,
 *   })), handler)
 */

const authorize = (permission, getContext) => {
  return async (req, res, next) => {
    try {
      const context = getContext?.(req) ?? {};
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
