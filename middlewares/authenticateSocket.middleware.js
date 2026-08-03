import { parseCookie } from "cookie";
import { User } from "#models/user.model.js";
import { EXCEPTION_CODES } from "#constants/exceptionCodes.constants.js";
import { verifyAccessToken } from "#utils/token.util.js";

/**
 * Socket.IO connection middleware — runs once per connection attempt, BEFORE the "connection"
 * event fires.
 *
 * IMPORTANT: this middleware runs entirely OUTSIDE Express. Socket.IO
 * attaches its own request listener directly to the HTTP server and
 * intercepts /socket.io/* requests before Express ever sees them — so:
 *   - cookie-parser has NOT run; socket.handshake.headers.cookie is the
 *     raw `Cookie` header string, parsed manually.
 *   - calling next(err) here does NOT reach app.use(globalErrorMiddleware).
 *     Socket.IO handles it itself: it aborts the handshake and emits a
 *     "connect_error" event on the client, built from ONLY err.message
 *     and err.data in rejectHandShake
 */

const rejectHandshake = (next, message, code) => {
  const err = new Error(message);
  // Guarantee the 'code' survives to the client
  err.data = { code };
  next(err);
};

const authenticateSocket = async (socket, next) => {
  try {
    const cookies = parseCookie(socket.handshake.headers.cookie ?? "");
    const token = cookies.accessToken ?? socket.handshake.auth?.token;

    if (!token) {
      return rejectHandshake(
        next,
        "Unauthorized: no token provided.",
        EXCEPTION_CODES.AUTH_REQUIRED,
      );
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err) {
      const code =
        err.name === "TokenExpiredError"
          ? EXCEPTION_CODES.TOKEN_EXPIRED
          : EXCEPTION_CODES.INVALID_TOKEN;
      return rejectHandshake(next, "Unauthorized: invalid token.", code);
    }

    const userId = payload.sub;

    if (!userId) {
      return rejectHandshake(
        next,
        "Unauthorized: user id claim missing.",
        EXCEPTION_CODES.INVALID_TOKEN,
      );
    }

    const user = await User.findOne({ _id: userId, isDeleted: false })
      .select("_id name username")
      .lean();

    if (!user) {
      return rejectHandshake(
        next,
        "Unauthorized: user not found.",
        EXCEPTION_CODES.INVALID_CREDENTIALS,
      );
    }

    // Attach the authenticated user to the socket. Every downstream handler reads from
    // socket.data.user instead of re-verifying the token per event.
    socket.data.user = {
      id: user._id.toString(),
      name: user.name,
      username: user.username,
    };

    next();
  } catch (err) {
    rejectHandshake(next, "Unauthorized.", EXCEPTION_CODES.AUTH_REQUIRED);
  }
};

export { authenticateSocket };
