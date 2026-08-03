/**
 * TODO (next step): port ChatHub.SendTyping.
 * Pure fire-and-forget relay, never persisted:
 *   socket.to(room).emit(SOCKET_EVENTS.USER_TYPING, { userId, userName, isTyping })
 * `socket.to(room)` (not `io.to(room)`) automatically excludes the sender,
 * matching Clients.OthersInGroup(...) semantics from the dotnet hub.
 */
const registerTypingHandlers = (socket) => {
  // placeholder — filled in next step
};

export { registerTypingHandlers };
