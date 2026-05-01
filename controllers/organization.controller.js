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

const getOrganizationAllMembers = TryCatch(async (req, res, next) => {
  const result = await orgService.getOrganizationAllMembers({
    orgId: req.params.orgId,
    userId: req.userId,
    query: req.query,
  });

  return sendResponse(res, 200, null, "Organization members fetched.", result);
});

const getOrganizationMember = TryCatch(async (req, res, next) => {
  const { orgId, membershipId } = req.params;
  const result = await orgService.getOrganizationMember({
    orgId,
    userId: req.userId,
    membershipId,
  });

  return sendResponse(res, 200, null, "Member details fetched.", result);
});

const getOrganizationPendingInvites = TryCatch(async (req, res, next) => {
  const { orgId } = req.params;
  const result = await orgService.getOrganizationPendingInvites({
    orgId,
    query: req.query,
  });

  return sendResponse(res, 200, null, "Pending invites fetched.", result);
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

const cancelOrganizationInvite = TryCatch(async (req, res, next) => {
  const { orgId, inviteId } = req.params;
  await orgService.cancelOrganizationInvite({
    inviteId,
    orgId,
  });

  return sendResponse(res, 200, null, "Invitation deleted successfully.");
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
  await orgService.createOrgInvitation({
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
  );
});

const addMemberToOrganization = TryCatch(async (req, res, next) => {
  const { orgId } = req.context;
  const { userId, role } = req.body;
  await orgService.addMemberToOrganization({
    orgId,
    invitedByUserId: req.userId,
    invitedUserId: userId,
    role,
  });

  return sendResponse(res, 200, null, "Member added successfully.");
});

const updateOrganizationMemberRole = TryCatch(async (req, res, next) => {
  const { orgId } = req.context;
  const { membershipId } = req.params;
  const { role } = req.body;
  await orgService.updateOrganizationMemberRole({
    orgId,
    role,
    membershipId,
  });

  return sendResponse(res, 200, null, "Member role updated.");
});

const transferOrganizationOwnership = TryCatch(async (req, res, next) => {
  const { orgId, membershipId } = req.params;
  await orgService.transferOrganizationOwnership({
    orgId,
    userId: req.userId,
    membershipId,
  });

  return sendResponse(res, 200, null, "Organization ownership transferred.");
});

const leaveOrganization = TryCatch(async (req, res, next) => {
  const { orgId } = req.params;
  await orgService.leaveOrganization({
    orgId,
    userId: req.userId,
  });

  return sendResponse(res, 200, null, "Left organization successfully.");
});

const removeOrganizationMember = TryCatch(async (req, res, next) => {
  const { orgId } = req.context;
  const { membershipId } = req.params;
  await orgService.removeOrganizationMember({
    orgId,
    userId: req.userId,
    membershipId,
  });

  return sendResponse(res, 200, null, "Member removed successfully.");
});

//#endregion

export {
  getOrganization,
  getMyOrganizations,
  getOrganizationAllMembers,
  getOrganizationMember,
  getOrganizationPendingInvites,
  createOrganization,
  updateOrganization,
  updateOrganizationIcon,
  createOrgInvitation,
  cancelOrganizationInvite,
  addMemberToOrganization,
  updateOrganizationMemberRole,
  transferOrganizationOwnership,
  leaveOrganization,
  removeOrganizationMember,
};
