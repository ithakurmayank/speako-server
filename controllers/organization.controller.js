import { orgService } from "#services/organization.service.js";
import { sendResponse } from "#utils/sendResponse.util.js";
import { TryCatch } from "../utils/errorHandler.util.js";

const createOrgInvitation = TryCatch(async (req, res, next) => {
  const { orgId } = req.context;
  const { role, email } = req.body;
  const { token } = await orgService.createOrgInvitation({
    orgId: orgId,
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

export { createOrgInvitation };
