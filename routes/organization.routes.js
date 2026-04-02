import { Router } from "express";
import { createOrgInvitation } from "../controllers/organization.controller.js";
import { createOrgInvitationSchema } from "#validators/organization.validators.js";
import { validate } from "#middlewares/validator.middleware.js";
import { authorize } from "#middlewares/authorize.middleware.js";
import { PERMISSIONS } from "#constants/permissions.constants.js";
import { authenticate } from "#middlewares/authenticate.middleware.js";

const router = Router({ mergeParams: true });

router.use(authenticate);
router.post(
  "/:orgId/invite",
  authorize(PERMISSIONS.ORG_MEMBERS_INVITE),
  validate(createOrgInvitationSchema),
  createOrgInvitation,
);

export default router;
