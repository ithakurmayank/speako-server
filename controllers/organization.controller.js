import { orgService } from "@services/organization.service.js";
import { TryCatch } from "../utils/errorHandler.util.js";
import { sendResponse } from "@utils/sendResponse.util.js";

const createOrgInvitation = TryCatch(async (req, res, next) => {
  const { role, email } = req.body;
  const { token } = await orgService.createOrgInvitation({
    orgId: req.orgId,
    role,
    email,
    createdBy: req.userId,
  });

  return sendResponse(res, 200, null, "Invitation sent successfully", {
    token,
  });
});

export { createOrgInvitation };
