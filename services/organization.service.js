import { ORG_INVITATION_EXPIRY_SECONDS } from "#constants/common.constants.js";
import { EXCEPTION_CODES } from "#constants/exceptionCodes.constants.js";
import { ORG_ROLES, ORG_ROLES_VALUES } from "#constants/roles.constants.js";
import { Invitation } from "#models/invitation.model.js";
import { NOTIFICATION_TEMPLATE_NAMES } from "#models/notificationTemplate.model.js";
import { User } from "#models/user.model.js";
import { ErrorHandler } from "#utils/errorHandler.util.js";
import { generateInvitationToken, hashToken } from "#utils/token.util.js";
import dayjs from "dayjs";
import env from "../configs/env.config.js";
import { outboxService } from "./outbox.service.js";
import { userService } from "./user.service.js";
import { Organization } from "#models/organization.model.js";
import { Membership } from "#models/membership.model.js";
import { MEMBER_SCOPES } from "#constants/user.constants.js";
import mongoose from "mongoose";
import { uploadIcon } from "../lib/cloudinary.lib.js";
import {
  getOffsetPaginationValues,
  getPaginatedResponse,
} from "#utils/pagination.util.js";

//#region GET services
const getOrganization = async ({ orgId, userId }) => {
  const isMember = await Membership.exists({
    orgId,
    userId,
    scope: MEMBER_SCOPES.ORG,
  });

  if (!isMember) {
    throw new ErrorHandler(
      "Organization not found.",
      EXCEPTION_CODES.NOT_FOUND,
    );
  }

  const org = await Organization.findOne({
    _id: orgId,
    isDeleted: false,
  }).lean();

  if (!org) {
    throw new ErrorHandler(
      "Organization not found.",
      EXCEPTION_CODES.NOT_FOUND,
    );
  }

  return {
    id: org._id,
    name: org.name,
    slug: org.slug,
    iconUrl: org.icon?.url ?? null,
    createdAt: org.createdAt,
  };
};

const getMyOrganizations = async ({ userId }) => {
  const memberships = await Membership.find({
    userId,
    scope: MEMBER_SCOPES.ORG,
  })
    .populate({
      path: "orgId",
      match: { isDeleted: false },
      select: "name slug icon createdAt",
    })
    .sort({ joinedAt: 1 })
    .lean();

  return memberships
    .filter((m) => m.orgId != null)
    .map((m) => ({
      id: m.orgId._id,
      name: m.orgId.name,
      slug: m.orgId.slug,
      iconUrl: m.orgId.icon?.url ?? null,
      createdAt: m.orgId.createdAt,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
};

const getOrganizationMembers = async ({ orgId, userId, query }) => {
  const isMember = await Membership.exists({
    userId,
    orgId,
    scope: MEMBER_SCOPES.ORG,
  });

  if (!isMember) {
    throw new ErrorHandler(
      "Organization not found.",
      EXCEPTION_CODES.NOT_FOUND,
    );
  }

  const { search, role, pageNumber, pageSize } = query;
  const { page, size, skip, limit } = getOffsetPaginationValues({
    pageNumber,
    pageSize,
  });

  const filter = {
    orgId,
    scope: MEMBER_SCOPES.ORG,
  };

  if (role) {
    filter.role = role;
  }

  // If search is provided, first resolve matching userIds from User collection
  let userIdFilter = null;
  if (search) {
    const term = search.trim();
    const matchingUsers = await User.find({
      $or: [
        { name: { $regex: term, $options: "i" } },
        { username: { $regex: term, $options: "i" } },
      ],
    })
      .select("_id")
      .lean();

    userIdFilter = matchingUsers.map((u) => u._id);
    filter.userId = { $in: userIdFilter };
  }

  const [totalCount, memberships] = await Promise.all([
    Membership.countDocuments(filter),
    Membership.find(filter)
      .populate({
        path: "userId",
        select: "name username icon",
      })
      .sort({ joinedAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const items = memberships.map((m) => ({
    membershipId: m._id,
    userId: m.userId._id,
    name: m.userId.name,
    username: m.userId.username,
    iconUrl: m.userId.icon?.url ?? null,
    role: m.role,
    joinedAt: m.joinedAt,
  }));

  return getPaginatedResponse({
    items,
    totalCount,
    pageNumber: page,
    pageSize: size,
  });
};
//#endregion

//#region UPDATE services
const createOrganization = async ({ userId, name, slug }) => {
  const user = await userService.getUserWithLean(userId);

  const existingOrgWithSlug = await Organization.findOne({
    slug,
  }).lean();
  if (existingOrgWithSlug) {
    throw new ErrorHandler(
      "This slug is already taken by another organization.",
      EXCEPTION_CODES.DUPLICATE_RESOURCE,
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const [org] = await Organization.create(
      [
        {
          name,
          slug,
          createdBy: user._id,
        },
      ],
      { session },
    );

    await Membership.create(
      [
        {
          userId: user._id,
          orgId: org._id,
          scope: MEMBER_SCOPES.ORG,
          role: ORG_ROLES.OrgOwner,
          joinedAt: new Date(),
        },
      ],
      { session },
    );

    await session.commitTransaction();

    return { org: { _id: org._id, name: org.name, slug: org.slug } };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

const updateOrganization = async ({ orgId, name }) => {
  const updatedOrg = await Organization.findOneAndUpdate(
    { _id: orgId },
    { $set: { name } },
    { new: true },
  );

  if (!updatedOrg) {
    throw new ErrorHandler(
      "Invalid organization id.",
      EXCEPTION_CODES.INVALID_INPUT,
    );
  }

  return updatedOrg;
};

const updateOrganizationIcon = async ({ orgId, icon }) => {
  if (!icon)
    throw new ErrorHandler(
      "Missing field - icon",
      EXCEPTION_CODES.MISSING_REQUIRED_FIELDS,
    );

  const org = await Organization.findById(orgId);
  if (!org)
    throw new ErrorHandler(
      "Organization not found",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );

  const { url, publicId } = await uploadIcon(icon.buffer, "org", {
    orgId,
  });

  org.icon = { url, publicId };
  await org.save();

  return { icon: org.icon.url };
};

const createOrgInvitation = async ({ orgId, role, email, createdBy }) => {
  if (!ORG_ROLES_VALUES.includes(role)) {
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
    {
      // to: email,
      to: "mt3197356@gmail.com", //delete/remove this when hosting,
      templateName: NOTIFICATION_TEMPLATE_NAMES.ORG_INVITATION_EMAIL,
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
        year: dayjs().year(),
      },
    },
    createdBy,
  );

  return { token };
};

const addMemberToOrganization = async ({
  orgId,
  invitedByUserId,
  invitedUserId,
  role,
}) => {
  const user = await userService.getUserWithLean(
    invitedUserId,
    "Selected user does not exist.",
  );

  await Membership.findOneAndUpdate(
    {
      userId: user._id,
      orgId,
      scope: MEMBER_SCOPES.ORG,
    },
    {
      $setOnInsert: {
        userId: user._id,
        orgId,
        scope: MEMBER_SCOPES.ORG,
        role,
        invitedBy: invitedByUserId,
        joinedAt: new Date(),
      },
    },
    {
      upsert: true,
      new: true,
    },
  );
};

const updateOrganizationMemberRole = async ({ orgId, membershipId, role }) => {
  const updatedMembership = await Membership.findOneAndUpdate(
    {
      _id: membershipId,
      orgId,
    },
    { $set: { role } },
    { new: true },
  );

  if (!updatedMembership) {
    throw new ErrorHandler("Membership not found.", EXCEPTION_CODES.NOT_FOUND);
  }
};

//#endregion

export const orgService = {
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
