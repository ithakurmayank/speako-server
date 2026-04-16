import { Router } from "express";
import {
  addMemberToOrganization,
  createOrganization,
  createOrgInvitation,
  getMyOrganizations,
  getOrganization,
  getOrganizationAllMembers,
  getOrganizationMember,
  getOrganizationPendingInvites,
  leaveOrganization,
  removeOrganizationMember,
  transferOrganizationOwnership,
  updateOrganization,
  updateOrganizationIcon,
  updateOrganizationMemberRole,
} from "../controllers/organization.controller.js";
import {
  addMemberToOrganizationSchema,
  createOrganizationSchema,
  createOrgInvitationSchema,
  getOrganizationMembersSchema,
  getOrganizationMembersSchema as getOrganizationPendingInvitesSchema,
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
//#region GET controllers
router.get("/my", getMyOrganizations);

router.get("/:orgId", getOrganization);

router.get(
  "/:orgId/members",
  validate(getOrganizationMembersSchema),
  getOrganizationAllMembers,
);

router.get("/:orgId/members/:membershipId", getOrganizationMember);

router.get(
  "/:orgId/invites",
  validate(getOrganizationPendingInvitesSchema),
  authorize(PERMISSIONS.ORG_MEMBERS_INVITE),
  getOrganizationPendingInvites,
);

//#endregion

//#region UPDATE services
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

router.put(
  "/:orgId/members/:membershipId/transfer-ownership",
  transferOrganizationOwnership,
);

router.put("/:orgId/leave", leaveOrganization);

router.delete(
  "/:orgId/members/:membershipId",
  authorize(PERMISSIONS.ORG_MEMBERS_REMOVE),
  removeOrganizationMember,
);

//#endregion

export default router;
