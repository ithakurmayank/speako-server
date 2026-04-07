import { ORG_INVITATION_EXPIRY_SECONDS } from "#constants/common.constants.js";
import { EXCEPTION_CODES } from "#constants/exceptionCodes.constants.js";
import { OUTBOX_MESSAGE_TYPES } from "#constants/notifications.constants.js";
import { ALL_ROLES_VALUES } from "#constants/roles.constants.js";
import { Invitation } from "#models/invitation.model.js";
import { TEMPLATE_TYPES } from "#models/notificationTemplate.model.js";
import { User } from "#models/user.model.js";
import { ErrorHandler } from "#utils/errorHandler.util.js";
import { generateInvitationToken, hashToken } from "#utils/token.util.js";
import dayjs from "dayjs";
import env from "../configs/env.config.js";
import { outboxService } from "./outbox.service.js";

const createOrgInvitation = async ({ orgId, role, email, createdBy }) => {
  if (!ALL_ROLES_VALUES.includes(role)) {
    throw new ErrorHandler(
      "Provided role does not exist.",
      EXCEPTION_CODES.INVALID_INPUT,
    );
  }

  const existingUser = await User.findOne({ email, isDeleted: false }).lean();
  if (existingUser) {
    throw new ErrorHandler(
      "User already exists with this email.",
      EXCEPTION_CODES.INVALID_INPUT,
    );
  }

  const invitation = await Invitation.findOne({
    email,
    orgId,
    isUsed: false,
    expiresAt: { $gt: new Date() },
  });

  if (invitation) {
    throw new ErrorHandler(
      "Invitation already exists.",
      EXCEPTION_CODES.DUPLICATE_RESOURCE,
    );
  }

  const expiresAt = dayjs()
    .add(ORG_INVITATION_EXPIRY_SECONDS, "second")
    .toDate();
  const token = generateInvitationToken();
  const hashedToken = hashToken(token);

  await Invitation.create({
    orgId,
    createdBy,
    email,
    role,
    token: hashedToken,
    expiresAt,
  });

  const expiryDays = Math.round(
    dayjs()
      .add(ORG_INVITATION_EXPIRY_SECONDS, "second")
      .diff(dayjs(), "day", true),
  );
  await outboxService.queueEmail(
    OUTBOX_MESSAGE_TYPES.ORG_INVITATION_EMAIL,
    {
      // to: email,
      to: "mt3197356@gmail.com", //delete/remove this when hosting,
      templateName: "OrgInvite",
      templateType: TEMPLATE_TYPES.EMAIL,
      variables: {
        recipientName: email,
        inviterName: "Organization Admin",
        orgName: env.APP_NAME,
        orgInitial: env.APP_NAME.slice(0, 1),
        // orgIconUrl: "",
        roleName: role,
        inviteLink: `${env.FRONTEND_URL}/invite/${token}`,

        appName: env.APP_NAME,
        expiryDays,
      },
    },
    createdBy,
  );

  return { token };
};

export const orgService = { createOrgInvitation };
