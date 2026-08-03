/**
 * TODO (next step): port ChatHub.JoinChannel / LeaveChannel.
 *
 * Planned shape:
 *   socket.on(SOCKET_EVENTS.JOIN_CHANNEL, async (channelId, cb) => {
 *     const allowed = await hubAuthorization.canAccessChannel(userId, channelId);
 *     if (!allowed) return cb?.({ ok: false, message: "..." });
 *     socket.join(channelRoom(channelId));
 *     cb?.({ ok: true });
 *   });
 *
 * cb is the ack callback — the Socket.IO substitute for HubException,
 * since there's no way to "throw" back to the caller.
 */
const registerChannelHandlers = (socket) => {
  // placeholder — filled in next step
};

export { registerChannelHandlers };
