import {
  userRoom,
  presenceRoom,
  SOCKET_EVENTS,
} from "#constants/socket.constants.js";

/**
 * The ONLY module that should ever call `io.to(...).emit(...)`.
 * Every other part of the app — REST controllers, message/reaction/pin
 * services, the socket handlers themselves — pushes real-time events
 * through these functions instead of touching `io` directly.
 */

let ioInstance = null;

const initSocketEmitter = (io) => {
  ioInstance = io;
};

const getIo = () => {
  if (!ioInstance) {
    throw new Error(
      "Socket.IO instance not initialized. Call initSocketEmitter(io) before using the emitter.",
    );
  }
  return ioInstance;
};

// Presence

/** Pushes to the user's own tabs AND anyone watching them (sidebar viewers). */
const broadcastPresence = (userId, presence) => {
  const io = getIo();
  io.to(userRoom(userId)).emit(SOCKET_EVENTS.USER_PRESENCE_CHANGED, presence);
  io.to(presenceRoom(userId)).emit(
    SOCKET_EVENTS.USER_PRESENCE_CHANGED,
    presence,
  );
};

// Personal feed (user:{userId})

const pushNotification = (userId, notification) => {
  getIo()
    .to(userRoom(userId))
    .emit(SOCKET_EVENTS.NOTIFICATION_RECEIVED, notification);
};

const pushReadStateBadge = (userId, badge) => {
  getIo().to(userRoom(userId)).emit(SOCKET_EVENTS.READ_STATE_UPDATED, badge);
};

//  Channel / conversation message events
// TODO (next step): channel message/edit/delete/reaction/pin emitters
// TODO (next step): conversation message/edit/delete/reaction/pin emitters
// TODO (next step): conversation delivered/seen emitters (uses arrayFilters
//                    update on Message.receipts for group conversations)
// TODO (next step): thread update emitters

export {
  initSocketEmitter,
  broadcastPresence,
  pushNotification,
  pushReadStateBadge,
};
