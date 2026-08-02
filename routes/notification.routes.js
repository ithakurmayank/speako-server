import {
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
} from "#controllers/notification.controller.js";
import { authenticate } from "#middlewares/authenticate.middleware.js";
import { validate } from "#middlewares/validator.middleware.js";
import { getNotificationsSchema } from "#validators/notification.validators.js";
import { Router } from "express";

const router = Router({ mergeParams: true });

router.use(authenticate);

//#region GET controllers
router.get("/", validate(getNotificationsSchema), getNotifications);

router.get("/unread-count", getUnreadCount);

//#endregion

//#region UPDATE services
router.post("/:notificationId/read", markAsRead);

router.post("/read-all", markAllAsRead);
//#endregion

export default router;
