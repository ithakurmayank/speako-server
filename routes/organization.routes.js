import { Router } from "express";
import {
  addMemberToOrganization,
  createOrganization,
  createOrgInvitation,
  updateOrganization,
  updateOrganizationIcon,
  updateOrganizationMemberRole,
} from "../controllers/organization.controller.js";
import {
  addMemberToOrganizationSchema,
  createOrganizationSchema,
  createOrgInvitationSchema,
  updateOrganizationMemberRoleSchema,
  updateOrganizationSchema,
} from "#validators/organization.validators.js";
import { validate } from "#middlewares/validator.middleware.js";
import { authorize } from "#middlewares/authorize.middleware.js";
import { PERMISSIONS } from "#constants/permissions.constants.js";
import { authenticate } from "#middlewares/authenticate.middleware.js";
import { iconUploadMiddleware } from "#middlewares/multer.middleware.js";

const router = Router({ mergeParams: true });

router.use(authenticate);
router.post("/", validate(createOrganizationSchema), createOrganization);
router.put(
  "/:orgId",
  authorize(PERMISSIONS.ORG_SETTINGS_EDIT),
  validate(updateOrganizationSchema),
  updateOrganization,
);
router.put(
  "/:orgId/icon",
  authorize(PERMISSIONS.ORG_SETTINGS_EDIT),
  iconUploadMiddleware,
  updateOrganizationIcon,
);
router.post(
  "/:orgId/invite",
  authorize(PERMISSIONS.ORG_MEMBERS_INVITE),
  validate(createOrgInvitationSchema),
  createOrgInvitation,
);
router.post(
  "/:orgId/members",
  authorize(PERMISSIONS.ORG_MEMBERS_INVITE),
  validate(addMemberToOrganizationSchema),
  addMemberToOrganization,
);
router.put(
  "/:orgId/members/:membershipId/role",
  authorize(PERMISSIONS.ORG_MEMBERS_ROLE_CHANGE),
  validate(updateOrganizationMemberRoleSchema),
  updateOrganizationMemberRole,
);

export default router;
