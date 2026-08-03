// Room-name helpers
const channelRoom = (channelId) => `channel:${channelId}`;
const conversationRoom = (conversationId) => `conv:${conversationId}`;
const userRoom = (userId) => `user:${userId}`;
const presenceRoom = (watchedUserId) => `presence:${watchedUserId}`;

// Central registry of every Socket.IO event name.
// Server emits these to clients (S2C) and listens for these from clients (C2S).
const SOCKET_EVENTS = Object.freeze({
  // ── Connection / system (built into Socket.IO, listed for reference) ──
  CONNECT: "connect",
  DISCONNECT: "disconnect",
  CONNECT_ERROR: "connect_error",

  // ── Room management (C2S) ───────────────────────────────────────────
  JOIN_CHANNEL: "joinChannel",
  LEAVE_CHANNEL: "leaveChannel",
  JOIN_CONVERSATION: "joinConversation",
  LEAVE_CONVERSATION: "leaveConversation",
  JOIN_PRESENCE: "joinPresence",
  LEAVE_PRESENCE: "leavePresence",

  // ── Messages (S2C) ───────────────────────────────────────────────────
  MESSAGE_RECEIVED: "messageReceived",
  MESSAGE_EDITED: "messageEdited",
  MESSAGE_DELETED: "messageDeleted",
  REACTION_TOGGLED: "reactionToggled",
  MESSAGE_PINNED: "messagePinned",

  // ── Delivery / seen (C2S ack + S2C push) ────────────────────────────
  ACK_MESSAGE_DELIVERED: "ackMessageDelivered",
  ACK_MESSAGES_SEEN: "ackMessagesSeen",
  MESSAGE_DELIVERED: "messageDelivered",
  MESSAGE_SEEN: "messageSeen",

  // ── Typing (C2S + S2C relay) ─────────────────────────────────────────
  SEND_TYPING: "sendTyping",
  USER_TYPING: "userTyping",

  // ── Presence (C2S + S2C) ─────────────────────────────────────────────
  SET_STATUS: "setStatus",
  USER_PRESENCE_CHANGED: "userPresenceChanged",

  // ── Notifications / read state / threads (S2C) ──────────────────────
  NOTIFICATION_RECEIVED: "notificationReceived",
  READ_STATE_UPDATED: "readStateUpdated",
  THREAD_UPDATED: "threadUpdated",
});

export { channelRoom, conversationRoom, userRoom, presenceRoom, SOCKET_EVENTS };
