/**
 * Tracks how many active Socket.IO connections each user has open
 * (multiple tabs/devices = multiple connections for one user).
 *
 * Needed so presence only flips to Online on the FIRST connection and
 * Offline on the LAST disconnection. Keyed by a Set of socket ids (rather than a
 * raw count) so we can also answer "which sockets belong to this user"
 * later if needed (e.g. force-disconnect on ban/session revoke).
 *
 * In-memory only — fine for a single Node process. If you scale to
 * multiple instances behind the Redis adapter, this needs to move to
 * Redis too (e.g. a Set per user key), since each instance would
 * otherwise only know about its own slice of connections and could
 * flip presence Offline while the user is still connected elsewhere.
 */
class ConnectionTracker {
  constructor() {
    /** @type {Map<string, Set<string>>} userId -> Set of socket ids */
    this._connections = new Map();
  }

  /**
   * @param {string} userId
   * @param {string} socketId
   * @returns {boolean} true if this is the user's first active connection
   */
  addConnection(userId, socketId) {
    const existingSocketIds = this._connections.get(userId);

    if (!existingSocketIds) {
      this._connections.set(userId, new Set([socketId]));
      return true; // first connection
    }

    existingSocketIds.add(socketId);
    return false;
  }

  /**
   * @param {string} userId
   * @param {string} socketId
   * @returns {boolean} true if this was the user's last active connection
   */
  removeConnection(userId, socketId) {
    const existingSocketIds = this._connections.get(userId);

    if (!existingSocketIds) return true; // not tracked — treat as last

    existingSocketIds.delete(socketId);

    if (existingSocketIds.size === 0) {
      this._connections.delete(userId);
      return true;
    }

    return false;
  }

  getConnectionCount(userId) {
    return this._connections.get(userId)?.size ?? 0;
  }

  isOnline(userId) {
    return this.getConnectionCount(userId) > 0;
  }
}

// Singleton — lives for the process lifetime
const connectionTracker = new ConnectionTracker();

export { connectionTracker };
