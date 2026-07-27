import { teamService } from "#services/team.service.js";
import { TryCatch } from "#utils/errorHandler.util.js";
import { sendResponse } from "#utils/sendResponse.util.js";

/**
 * @typedef {import("#types/express.js").Request} Request
 * @typedef {import("#types/express.js").Response} Response
 */

//#region GET controllers
/**
 * @param {Request} req
 * @param {Response} res
 */
const getTeams = TryCatch(async (req, res) => {
  const { orgId } = req.context;
  const { search, isArchived, includePrivate, pageSize, pageNumber } =
    req.query;

  const result = await teamService.getTeams({
    orgId,
    userId: req.userId,
    search,
    isArchived: isArchived !== undefined ? isArchived === "true" : undefined,
    includePrivate: includePrivate !== "false", // default true
    pageSize: parseInt(pageSize) || 20,
    pageNumber: parseInt(pageNumber) || 1,
  });

  return sendResponse(res, 200, null, "Teams fetched successfully.", result);
});

const getTeam = TryCatch(async (req, res) => {
  const { orgId, teamId } = req.context;

  const result = await teamService.getTeam({
    orgId,
    teamId,
    userId: req.userId,
  });

  return sendResponse(res, 200, null, "Team fetched successfully.", result);
});

const getTeamMembers = TryCatch(async (req, res) => {
  const { orgId, teamId } = req.context;

  const result = await teamService.getTeamMembers({
    orgId,
    teamId,
    userId: req.userId,
    query: req.query,
  });

  return sendResponse(
    res,
    200,
    null,
    "Team members fetched successfully.",
    result,
  );
});
//#endregion

//#region UPDATE controllers
const createTeam = TryCatch(async (req, res) => {
  const { orgId } = req.context;
  const { name, description, isPrivate } = req.body;

  await teamService.createTeam({
    orgId,
    userId: req.userId,
    name,
    description,
    isPrivate,
  });

  return sendResponse(res, 201, null, "Team created successfully.");
});

const updateTeam = TryCatch(async (req, res) => {
  const { orgId, teamId } = req.context;
  const { name, description } = req.body;

  await teamService.updateTeam({
    orgId,
    teamId,
    userId: req.userId,
    name,
    description,
  });

  return sendResponse(res, 200, null, "Team updated successfully.");
});

const updateTeamIcon = TryCatch(async (req, res) => {
  const { orgId, teamId } = req.context;
  const icon = req.file;

  await teamService.updateTeamIcon({
    orgId,
    teamId,
    icon,
  });

  return sendResponse(res, 200, null, "Team icon updated successfully.");
});

const removeTeamIcon = TryCatch(async (req, res) => {
  const { orgId, teamId } = req.context;

  await teamService.removeTeamIcon({
    orgId,
    teamId,
  });

  return sendResponse(res, 200, null, "Team icon removed successfully.");
});

const archiveTeam = TryCatch(async (req, res) => {
  const { orgId, teamId } = req.context;

  await teamService.archiveTeam({
    orgId,
    teamId,
    userId: req.userId,
  });

  return sendResponse(res, 200, null, "Team archived successfully.");
});

const unarchiveTeam = TryCatch(async (req, res) => {
  const { orgId, teamId } = req.context;

  await teamService.unarchiveTeam({
    orgId,
    teamId,
  });

  return sendResponse(res, 200, null, "Team unarchived successfully.");
});

const addTeamMember = TryCatch(async (req, res) => {
  const { orgId, teamId } = req.context;
  const { userId: targetUserId, role } = req.body;

  await teamService.addTeamMember({
    orgId,
    teamId,
    userId: req.userId,
    targetUserId,
    role,
  });

  return sendResponse(res, 200, null, "Member added to team successfully.");
});

const updateTeamMemberRole = TryCatch(async (req, res) => {
  const { orgId, teamId } = req.context;
  const { membershipId } = req.params;
  const { role } = req.body;

  await teamService.updateTeamMemberRole({
    orgId,
    teamId,
    membershipId,
    role,
  });

  return sendResponse(res, 200, null, "Member role updated successfully.");
});

const removeTeamMember = TryCatch(async (req, res) => {
  const { orgId, teamId } = req.context;
  const { membershipId } = req.params;

  await teamService.removeTeamMember({
    orgId,
    teamId,
    membershipId,
    userId: req.userId,
  });

  return sendResponse(res, 200, null, "Member removed from team successfully.");
});

const leaveTeam = TryCatch(async (req, res) => {
  const { orgId, teamId } = req.context;

  await teamService.leaveTeam({
    orgId,
    teamId,
    userId: req.userId,
  });

  return sendResponse(res, 200, null, "Left the team successfully.");
});
//#endregion

export {
  getTeams,
  getTeam,
  getTeamMembers,
  createTeam,
  updateTeam,
  updateTeamIcon,
  removeTeamIcon,
  archiveTeam,
  unarchiveTeam,
  addTeamMember,
  updateTeamMemberRole,
  removeTeamMember,
  leaveTeam,
};
