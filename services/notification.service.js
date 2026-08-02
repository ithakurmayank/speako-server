import { EXCEPTION_CODES } from "#constants/exceptionCodes.constants.js";
import { Notification } from "#models/notification.model.js";
import { User } from "#models/user.model.js";
import { ErrorHandler } from "#utils/errorHandler.util.js";
import {
  getOffsetPaginationValues,
  getPaginatedResponse,
} from "#utils/pagination.util.js";

//#region GET services
const getNotifications = async ({ userId, ...query }) => {
  // Step 1: Resolve pagination values and fetch the count + page in parallel.
  const { page, size, skip, limit } = getOffsetPaginationValues(query);

  const [totalCount, notifications] = await Promise.all([
    Notification.countDocuments({ recipientId: userId }),
    Notification.find({ recipientId: userId })
      .sort({ isRead: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  // Step 2: Empty-page early return — skip the actor batch lookup entirely if there's nothing to enrich.
  if (notifications.length === 0) {
    return getPaginatedResponse({
      data: [],
      totalCount,
      pageNumber: page,
      pageSize: size,
    });
  }

  // Step 3: Batch-fetch actor info (name + avatar) for every distinct actorId on this page,
  // instead of N+1 lookups per notification.
  const actorIds = [
    ...new Set(
      notifications.filter((n) => n.actorId).map((n) => n.actorId.toString()),
    ),
  ];

  const actors = actorIds.length
    ? await User.find({ _id: { $in: actorIds } })
        .select("name icon")
        .lean()
    : [];

  const actorsMap = new Map(actors.map((a) => [a._id.toString(), a]));

  // Step 4: Shape the DTO, pulling actor name/avatar from the map (null if actorId is null
  // or the actor was deleted and no longer matches).
  const data = notifications.map((n) => {
    const actor = n.actorId ? actorsMap.get(n.actorId.toString()) : null;

    return {
      id: n._id,
      type: n.type,

      isRead: n.isRead,
      readAt: n.readAt ?? null,
      createdAt: n.createdAt,

      preview: n.preview ?? null,

      actorId: n.actorId ?? null,
      actorName: actor?.name ?? null,
      actorAvatarUrl: actor?.icon?.url ?? null,

      messageId: n.messageId ?? null,
      channelId: n.channelId ?? null,
      teamId: n.teamId ?? null,
      conversationId: n.conversationId ?? null,
    };
  });

  return getPaginatedResponse({
    data,
    totalCount,
    pageNumber: page,
    pageSize: size,
  });
};

const getUnreadCount = async ({ userId }) => {
  // Step 1: Single count query scoped to this user's unread notifications.
  const count = await Notification.countDocuments({
    recipientId: userId,
    isRead: false,
  });

  return { count };
};
//#endregion

//#region UPDATE services
const markAsRead = async ({ userId, notificationId }) => {
  // Step 1: Ownership-scoped existence check. A notification that exists but belongs
  // to another user must look identical to one that doesn't exist at all.
  const notification = await Notification.findOne({
    _id: notificationId,
    recipientId: userId,
  }).lean();

  if (!notification) {
    throw new ErrorHandler(
      "Notification not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // Step 2: Already-read is a no-op — avoid an
  // unnecessary write and don't overwrite the original readAt timestamp.
  if (notification.isRead) return;

  await Notification.updateOne(
    { _id: notificationId },
    { $set: { isRead: true, readAt: new Date() } },
  );
};

const markAllAsRead = async ({ userId }) => {
  // Step 1: Bulk update, scoped to unread notifications only — avoids touching already-read docs (no-op filter, no need
  // to load/check anything first since this is a single unconditional bulk write).
  await Notification.updateMany(
    { recipientId: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } },
  );
};

//#endregion

export const notificationService = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};
