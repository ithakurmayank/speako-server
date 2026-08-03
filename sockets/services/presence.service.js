import { UserStatus } from "#models/userStatus.model.js";
import { USER_STATUS } from "#constants/user.constants.js";

/**
 * Presence lifecycle -
 * Called by the connection handler on first-connect / last-disconnect, and
 * (once ported) by the "setStatus" socket handler.
 */

const onUserConnected = async (userId) => {
  const status = await UserStatus.findOne({ userId });

  if (!status) {
    console.warn(
      `[Presence] UserStatus row missing for userId=${userId}. Skipping.`,
    );
    return;
  }

  status.status = USER_STATUS.ONLINE;
  status.lastSeenAt = new Date();
  await status.save();
};

const onUserDisconnected = async (userId) => {
  const status = await UserStatus.findOne({ userId });

  if (!status) {
    console.warn(
      `[Presence] UserStatus row missing for userId=${userId}. Skipping.`,
    );
    return;
  }

  status.status = USER_STATUS.OFFLINE;
  status.lastSeenAt = new Date();
  await status.save();
};

const getStatus = async (userId) => {
  const status = await UserStatus.findOne({ userId }).lean();

  if (!status) {
    // Default to Offline if the row doesn't exist yet
    return {
      userId,
      status: USER_STATUS.OFFLINE,
      customStatus: null,
      lastSeenAt: new Date(),
    };
  }

  return {
    userId: status.userId,
    status: status.status,
    customStatus: status.customStatus,
    lastSeenAt: status.lastSeenAt,
  };
};

const setCustomStatus = async (userId, customStatus) => {
  const status = await UserStatus.findOne({ userId });

  if (!status) {
    console.warn(
      `[Presence] UserStatus row missing for userId=${userId}. Skipping.`,
    );
    return;
  }

  status.customStatus = customStatus;
  await status.save();
};

export const presenceService = {
  onUserConnected,
  onUserDisconnected,
  getStatus,
  setCustomStatus,
};
