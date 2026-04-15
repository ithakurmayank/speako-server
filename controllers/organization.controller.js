import { orgService } from "#services/organization.service.js";
import { sendResponse } from "#utils/sendResponse.util.js";
import { TryCatch } from "../utils/errorHandler.util.js";

//#region GET controllers
const getOrganization = TryCatch(async (req, res, next) => {
  const { orgId } = req.params;
  const result = await orgService.getOrganization({
    orgId,
    userId: req.userId,
  });

  return sendResponse(res, 200, null, "Org details fetched.", result);
});

const getMyOrganizations = TryCatch(async (req, res, next) => {
  const result = await orgService.getMyOrganizations({
    userId: req.userId,
  });

  return sendResponse(res, 200, null, "All organizations fetched.", result);
});

const getOrganizationMembers = TryCatch(async (req, res, next) => {
  const result = await orgService.getOrganizationMembers({
    orgId: req.context.orgId,
    userId: req.userId,
    query: req.query,
  });

  return sendResponse(res, 200, null, "All organizations fetched.", result);
});

//#endregion

//#region UPDATE services
const createOrganization = TryCatch(async (req, res, next) => {
  const { name, slug } = req.body;
  const result = await orgService.createOrganization({
    userId: req.userId,
    name,
    slug,
  });

  return sendResponse(
    res,
    200,
    null,
    "Organization created successfully.",
    result,
  );
});

const updateOrganization = TryCatch(async (req, res, next) => {
  const { name } = req.body;
  const { orgId } = req.context;
  await orgService.updateOrganization({
    orgId,
    name,
  });

  return sendResponse(res, 200, null, "Organization updated successfully");
});

const updateOrganizationIcon = TryCatch(async (req, res, next) => {
  const { orgId } = req.context;
  const icon = req.file;
  await orgService.updateOrganizationIcon({
    orgId,
    icon,
  });

  return sendResponse(res, 200, null, "Organization icon updated.");
});

const createOrgInvitation = TryCatch(async (req, res, next) => {
  const { orgId } = req.context;
  const { role, email } = req.body;
  const { token } = await orgService.createOrgInvitation({
    orgId,
    role,
    email,
    createdBy: req.userId,
  });

  return sendResponse(
    res,
    200,
    null,
    "Invitation sent successfully through email.",
    {
      token,
    },
  );
});

const addMemberToOrganization = TryCatch(async (req, res, next) => {
  const { orgId } = req.context;
  const { invitedUserId, role } = req.body;
  await orgService.addMemberToOrganization({
    orgId,
    invitedByUserId: req.userId,
    invitedUserId,
    role,
  });

  return sendResponse(res, 200, null, "Member added successfully.");
});

const updateOrganizationMemberRole = TryCatch(async (req, res, next) => {
  const { orgId } = req.context;
  const { membershipId } = req.params;
  const { role, userId } = req.body;
  await orgService.updateOrganizationMemberRole({
    orgId,
    userId,
    role,
    membershipId,
  });

  return sendResponse(res, 200, null, "Member role updated.");
});

//#endregion

export {
  getOrganization,
  getMyOrganizations,
  getOrganizationMembers,
  createOrganization,
  updateOrganization,
  updateOrganizationIcon,
  createOrgInvitation,
  addMemberToOrganization,
  updateOrganizationMemberRole,
};
