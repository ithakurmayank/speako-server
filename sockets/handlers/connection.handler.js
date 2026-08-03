import { SOCKET_EVENTS, userRoom } from "#constants/socket.constants.js";
import { connectionTracker } from "#sockets/services/connectionTracker.service.js";
import { presenceService } from "#sockets/services/presence.service.js";
import { broadcastPresence } from "#sockets/services/socketEmitter.service.js";
import { registerChannelHandlers } from "./channel.handler.js";
import { registerConversationHandlers } from "./conversation.handler.js";
import { registerPresenceHandlers } from "./presence.handler.js";
import { registerReceiptHandlers } from "./receipt.handler.js";
import { registerTypingHandlers } from "./typing.handler.js";

/**
 * Wired up in sockets/index.js as:
 *   io.on("connection", (socket) => handleConnection(io, socket))
 *
 * Responsibilites:
 *   - joins the personal "user:{id}" room
 *   - flips presence Online only on the FIRST tab/device connecting
 *   - flips presence Offline only when the LAST tab/device disconnects
 *   - registers every other event-handler group for this socket
 *
 * By the time this runs, socket.data.user is already set by
 *   middleware (io.use), so no auth check needed here.
 */
const handleConnection = async (io, socket) => {
  const { id: userId } = socket.data.user;

  // Always join the personal feed room — this is where notifications,
  // read-state badges, and "my own presence changed" pushes land.
  socket.join(userRoom(userId));

  const isFirstConnection = connectionTracker.addConnection(userId, socket.id);

  if (isFirstConnection) {
    await presenceService.onUserConnected(userId);
    const presence = await presenceService.getStatus(userId);
    broadcastPresence(userId, presence);
  }

  // Register the rest of this socket's event handlers. Each of these is a
  // separate module so this file doesn't balloon as functionality grows.
  registerChannelHandlers(socket);
  registerConversationHandlers(socket);
  registerPresenceHandlers(socket);
  registerTypingHandlers(socket);
  registerReceiptHandlers(socket);

  socket.on(SOCKET_EVENTS.DISCONNECT, () => handleDisconnect(socket));
};

const handleDisconnect = async (socket) => {
  const { id: userId } = socket.data.user;

  const isLastConnection = connectionTracker.removeConnection(
    userId,
    socket.id,
  );

  if (isLastConnection) {
    await presenceService.onUserDisconnected(userId);
    const presence = await presenceService.getStatus(userId);
    broadcastPresence(userId, presence);
  }
};

export { handleConnection };
