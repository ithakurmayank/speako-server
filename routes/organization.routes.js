import { Router } from "express";
import {
    addMemberToOrganization,
    createOrganization,
    createOrgInvitation,
} from "../controllers/organization.controller.js";
import {
    addMemberToOrganizationSchema,
    createOrganizationSchema,
    createOrgInvitationSchema,
} from "#validators/organization.validators.js";
import { validate } from "#middlewares/validator.middleware.js";
import { authorize } from "#middlewares/authorize.middleware.js";
import { PERMISSIONS } from "#constants/permissions.constants.js";
import { authenticate } from "#middlewares/authenticate.middleware.js";

const router = Router({ mergeParams: true });

router.use(authenticate);
router.post("/create", validate(createOrganizationSchema), createOrganization);
router.post(
    "/:orgId/invite",
    authorize(PERMISSIONS.ORG_MEMBERS_INVITE),
    validate(createOrgInvitationSchema),
    createOrgInvitation,
);
router.post(
    "/:orgId/add-member",
    authorize(PERMISSIONS.ORG_MEMBERS_INVITE),
    validate(addMemberToOrganizationSchema),
    addMemberToOrganization,
);

export default router;
