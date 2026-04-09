import { orgService } from "#services/organization.service.js";
import { sendResponse } from "#utils/sendResponse.util.js";
import { TryCatch } from "../utils/errorHandler.util.js";

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
        userId: req.userId,
        invitedUserId,
        role,
    });

    return sendResponse(res, 200, null, "Member added successfully.");
});

export { createOrganization, createOrgInvitation, addMemberToOrganization };
