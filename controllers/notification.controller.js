import { notificationService } from "#services/notification.service.js";
import { TryCatch } from "#utils/errorHandler.util.js";
import { sendResponse } from "#utils/sendResponse.util.js";

//#region GET controllers
const getNotifications = TryCatch(async (req, res) => {
  const { pageNumber, pageSize } = req.query;

  const result = await notificationService.getNotifications({
    userId: req.userId,
    pageNumber,
    pageSize,
  });

  return sendResponse(
    res,
    200,
    null,
    "Notifications fetched successfully.",
    result,
  );
});

const getUnreadCount = TryCatch(async (req, res) => {
  const result = await notificationService.getUnreadCount({
    userId: req.userId,
  });

  return sendResponse(
    res,
    200,
    null,
    "Unread count fetched successfully.",
    result,
  );
});
//#endregion

//#region UPDATE controllers
const markAsRead = TryCatch(async (req, res) => {
  const { notificationId } = req.params;

  await notificationService.markAsRead({
    userId: req.userId,
    notificationId,
  });

  return sendResponse(res, 200, null, "Notification marked as read.");
});

const markAllAsRead = TryCatch(async (req, res) => {
  await notificationService.markAllAsRead({
    userId: req.userId,
  });

  return sendResponse(res, 200, null, "All notifications marked as read.");
});
//#endregion

export { getNotifications, getUnreadCount, markAllAsRead, markAsRead };
