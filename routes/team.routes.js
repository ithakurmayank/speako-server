import { PERMISSIONS } from "#constants/permissions.constants.js";
import {
  addTeamMember,
  archiveTeam,
  createTeam,
  getTeam,
  getTeamMembers,
  getTeams,
  leaveTeam,
  removeTeamIcon,
  removeTeamMember,
  unarchiveTeam,
  updateTeam,
  updateTeamIcon,
  updateTeamMemberRole,
} from "#controllers/team.controller.js";
import { authorize } from "#middlewares/authorize.middleware.js";
import { iconUploadMiddleware } from "#middlewares/multer.middleware.js";
import { validate } from "#middlewares/validator.middleware.js";
import {
  addTeamMemberSchema,
  createTeamSchema,
  getTeamsSchema,
  updateTeamMemberRoleSchema,
  updateTeamSchema,
} from "#validators/team.validators.js";
import channelRoute from "./channel.routes.js";
import { Router } from "express";

const router = Router({ mergeParams: true });

// Do not need to authenticate as teamRoutes are mounted only in orgRoutes and orgRoutes already authenticates the user
// router.use(authenticate);

//#region GET routes
router.get("/", authorize(null), validate(getTeamsSchema), getTeams);

router.get("/:teamId", authorize(null), getTeam);

router.get("/:teamId/members", authorize(null), getTeamMembers);

//#endregion

//#region UPDATE routes
router.post(
  "/",
  authorize(PERMISSIONS.ORG_TEAMS_CREATE),
  validate(createTeamSchema),
  createTeam,
);
router.put(
  "/:teamId",
  authorize(PERMISSIONS.TEAM_SETTINGS_EDIT),
  validate(updateTeamSchema),
  updateTeam,
);

router.put(
  "/:teamId/icon",
  authorize(PERMISSIONS.TEAM_SETTINGS_EDIT),
  iconUploadMiddleware,
  updateTeamIcon,
);

router.delete(
  "/:teamId/icon",
  authorize(PERMISSIONS.TEAM_SETTINGS_EDIT),
  removeTeamIcon,
);

router.post(
  "/:teamId/archive",
  authorize(PERMISSIONS.TEAM_ARCHIVE),
  archiveTeam,
);

router.post(
  "/:teamId/unarchive",
  authorize(PERMISSIONS.TEAM_ARCHIVE),
  unarchiveTeam,
);

router.post(
  "/:teamId/members",
  authorize(PERMISSIONS.TEAM_MEMBERS_INVITE),
  validate(addTeamMemberSchema),
  addTeamMember,
);

router.put(
  "/:teamId/members/:membershipId/role",
  authorize(PERMISSIONS.TEAM_MEMBERS_ROLE_CHANGE),
  validate(updateTeamMemberRoleSchema),
  updateTeamMemberRole,
);

router.delete(
  "/:teamId/members/:membershipId",
  authorize(PERMISSIONS.TEAM_MEMBERS_KICK),
  removeTeamMember,
);

router.delete("/:teamId/members/me", leaveTeam);

//#endregion

//Channel Routes
router.use("/:teamId/channels", channelRoute);

export default router;
