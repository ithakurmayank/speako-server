/**
 * TODO (next step): port ChatHub.JoinPresence / LeavePresence / SetStatus.
 *   - JOIN_PRESENCE / LEAVE_PRESENCE: no auth check in the dotnet version
 *     (any authenticated user can watch anyone's presence) — join/leave
 *     presenceRoom(watchedUserId) directly.
 *   - SET_STATUS: calls presenceService.setCustomStatus(userId, customStatus)
 *     then broadcastPresence(userId, await presenceService.getStatus(userId)).
 *     See the note in presence.service.js about only exposing customStatus,
 *     not raw online/offline status, to the client.
 */
const registerPresenceHandlers = (socket) => {
  // placeholder — filled in next step
};

export { registerPresenceHandlers };
