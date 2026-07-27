import { EXCEPTION_CODES } from "#constants/exceptionCodes.constants.js";
import { CLOUDINARY_RESOURCE_TYPES } from "#constants/fileTypes.constants.js";
import { ORG_ROLES } from "#constants/roles.constants.js";
import { MEMBER_SCOPES } from "#constants/user.constants.js";
import { Channel } from "#models/channel.model.js";
import { Membership } from "#models/membership.model.js";
import { ReadState } from "#models/readState.model.js";
import { Team } from "#models/team.model.js";
import { User } from "#models/user.model.js";
import { ErrorHandler } from "#utils/errorHandler.util.js";
import {
  getOffsetPaginationValues,
  getPaginatedResponse,
} from "#utils/pagination.util.js";
import { deleteCloudinaryFile, uploadIcon } from "#lib/cloudinary.lib.js";

//#region GET services
const getTeams = async ({
  orgId,
  userId,
  search,
  isArchived,
  includePrivate,
  pageSize = 20,
  pageNumber = 1,
}) => {
  const orgMembership = await Membership.findOne({
    userId,
    orgId,
    scope: MEMBER_SCOPES.ORG,
  }).lean();

  if (!orgMembership) {
    throw new ErrorHandler(
      "Organization not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  const callerIsOrgAdmin =
    orgMembership.role === ORG_ROLES.OrgOwner ||
    orgMembership.role === ORG_ROLES.OrgAdmin;

  const filter = {
    orgId,
    isDeleted: false,
  };

  if (isArchived !== undefined) {
    filter.isArchived = isArchived;
  }

  if (search?.trim()) {
    filter.name = { $regex: search.trim(), $options: "i" };
  }

  if (!includePrivate) {
    // Only public teams
    filter.isPrivate = false;
  } else if (!callerIsOrgAdmin) {
    // Public teams OR Private teams where caller is a member
    const callerTeamIds = await Membership.find({
      userId,
      orgId,
      scope: MEMBER_SCOPES.TEAM,
    })
      .lean()
      .then((memberships) => memberships.map((m) => m.teamId));

    filter.$or = [{ isPrivate: false }, { _id: { $in: callerTeamIds } }];
  }
  // Org admins: no extra filter — they see all teams

  const {
    page: parsedPageNumber,
    size: parsedPageSize,
    skip,
    limit,
  } = getOffsetPaginationValues({ pageNumber, pageSize });

  const [totalCount, teams] = await Promise.all([
    Team.countDocuments(filter),
    Team.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
  ]);

  if (teams.length === 0) {
    return { data: [], totalCount, pageNumber, pageSize };
  }

  const allTeamsIds = teams.map((t) => t._id);

  const [myMemberships, memberCounts] = await Promise.all([
    Membership.find({
      userId,
      teamId: { $in: allTeamsIds },
      scope: MEMBER_SCOPES.TEAM,
    }).lean(),

    Membership.aggregate([
      { $match: { teamId: { $in: allTeamsIds }, scope: MEMBER_SCOPES.TEAM } },
      { $group: { _id: "$teamId", count: { $sum: 1 } } },
    ]),
  ]);

  const myMembershipsMap = new Map(
    myMemberships.map((m) => [m.teamId.toString(), m]),
  );

  const memberCountMap = new Map(
    memberCounts.map(({ _id, count }) => [_id.toString(), count]),
  );

  const data = teams.map((team) => {
    const membership = myMembershipsMap.get(team._id.toString()) ?? null;

    return {
      id: team._id,
      orgId: team.orgId,
      name: team.name,
      description: team.description ?? null,
      icon: team.icon.url ?? null,
      isPrivate: team.isPrivate,
      isArchived: team.isArchived,
      archivedAt: team.archivedAt ?? null,
      createdAt: team.createdAt,
      memberCount: memberCountMap.get(team._id.toString()) ?? 0,
      role: membership?.role ?? null,
      isMuted: membership?.isMuted ?? null,
      joinedAt: membership?.joinedAt ?? null,
    };
  });

  return getPaginatedResponse({
    data,
    totalCount,
    pageNumber: parsedPageNumber,
    pageSize: parsedPageSize,
  });
};

const getTeam = async ({ orgId, teamId, userId }) => {
  const orgMembership = await Membership.findOne({
    userId,
    orgId,
    scope: MEMBER_SCOPES.ORG,
  }).lean();

  if (!orgMembership) {
    throw new ErrorHandler(
      "Organization not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  const callerIsOrgAdmin =
    orgMembership.role === ORG_ROLES.OrgOwner ||
    orgMembership.role === ORG_ROLES.OrgAdmin;

  const filter = {
    _id: teamId,
    orgId,
    isDeleted: false,
  };

  if (!callerIsOrgAdmin) {
    // Non-admins can only see public teams OR private teams they belong to
    const callerTeamMembership = await Membership.findOne({
      userId,
      orgId,
      teamId,
      scope: MEMBER_SCOPES.TEAM,
    }).lean();

    filter.$or = [
      { isPrivate: false },
      { isPrivate: true, _id: callerTeamMembership ? teamId : null },
    ];
  }

  const team = await Team.findOne(filter).lean();

  if (!team) {
    throw new ErrorHandler(
      "Team not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  const memberCount = await Membership.countDocuments({
    teamId: team._id,
    orgId,
    scope: MEMBER_SCOPES.TEAM,
  });

  return {
    id: team._id,
    orgId: team.orgId,
    name: team.name,
    description: team.description ?? null,
    icon: team.icon ?? null,
    isPrivate: team.isPrivate,
    isArchived: team.isArchived,
    archivedAt: team.archivedAt ?? null,
    createdAt: team.createdAt,
    memberCount,
  };
};

const getTeamMembers = async ({ orgId, teamId, userId, query }) => {
  const { page, size, skip, limit } = getOffsetPaginationValues(query);
  const { search, role } = query;

  // Verify team exists in org and resolve caller's org + team roles in parallel
  const [team, callerOrgMembership, callerTeamMembership] = await Promise.all([
    Team.findOne({
      _id: teamId,
      orgId,
      isDeleted: false,
    }).lean(),

    Membership.findOne({
      userId,
      orgId,
      scope: MEMBER_SCOPES.ORG,
    }).lean(),

    Membership.findOne({
      userId,
      orgId,
      teamId,
      scope: MEMBER_SCOPES.TEAM,
    }).lean(),
  ]);

  if (!team || !callerOrgMembership) {
    throw new ErrorHandler(
      "Team not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  const callerHasElevatedAccess =
    callerOrgMembership.role === ORG_ROLES.OrgOwner ||
    callerOrgMembership.role === ORG_ROLES.OrgAdmin ||
    callerTeamMembership?.role === ORG_ROLES.TeamAdmin;

  // Private team — non-elevated callers must be an explicit member
  if (team.isPrivate && !callerHasElevatedAccess && !callerTeamMembership) {
    throw new ErrorHandler(
      "Team not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  const filter = {
    teamId,
    orgId,
    scope: MEMBER_SCOPES.TEAM,
  };

  if (role) {
    filter.role = role;
  }

  // Count + paginate memberships
  const [totalCount, memberships] = await Promise.all([
    Membership.countDocuments(filter),
    Membership.find(filter)
      .sort({ joinedAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  if (memberships.length === 0) {
    return getPaginatedResponse({
      data: [],
      totalCount,
      pageNumber: page,
      pageSize: size,
    });
  }

  // Fetch user details for this page of members
  const userIds = memberships.map((m) => m.userId);

  const users = await User.find(
    search?.trim()
      ? {
          _id: { $in: userIds },
          $or: [
            { name: { $regex: search.trim(), $options: "i" } },
            { username: { $regex: search.trim(), $options: "i" } },
          ],
        }
      : { _id: { $in: userIds } },
  )
    .select("_id name username icon")
    .lean();

  const usersMap = new Map(users.map((u) => [u._id.toString(), u]));

  const data = memberships
    .filter((m) => usersMap.has(m.userId.toString())) // exclude if user not matched search
    .map((m) => {
      const user = usersMap.get(m.userId.toString());
      return {
        membershipId: m._id,
        userId: user._id,
        name: user.name,
        username: user.username,
        icon: user.icon ?? null,
        role: m.role,
        joinedAt: m.joinedAt,
      };
    });

  return getPaginatedResponse({
    data,
    totalCount,
    pageNumber: page,
    pageSize: size,
  });
};
//#endregion

//#region UPDATE services
const createTeam = async ({
  orgId,
  userId,
  name,
  description,
  isPrivate = false,
}) => {
  const orgMembership = await Membership.findOne({
    userId,
    orgId,
    scope: MEMBER_SCOPES.ORG,
  }).lean();

  if (!orgMembership) {
    throw new ErrorHandler(
      "Organization not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // 2. Check for duplicate team name within the org (case-insensitive)
  const nameExists = await Team.exists({
    orgId,
    name: { $regex: `^${name.trim()}$`, $options: "i" },
    isDeleted: { $ne: true },
  });

  if (nameExists) {
    throw new ErrorHandler(
      "A team with this name already exists in the organization.",
      EXCEPTION_CODES.DUPLICATE_RESOURCE,
    );
  }

  const team = await Team.create({
    orgId,
    name: name.trim(),
    description: description ?? null,
    isPrivate,
    createdBy: userId,
  });

  // 4. Add creator as TeamAdmin membership
  await Membership.create({
    userId,
    orgId,
    teamId: team._id,
    scope: MEMBER_SCOPES.TEAM,
    role: ORG_ROLES.TeamAdmin,
    invitedBy: null,
    joinedAt: new Date(),
  });
};

const updateTeam = async ({ orgId, teamId, userId, name, description }) => {
  const team = await Team.findOne({
    _id: teamId,
    orgId,
    isDeleted: false,
  });

  if (!team) {
    throw new ErrorHandler(
      "Team not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  if (team.isArchived) {
    throw new ErrorHandler(
      "Archived teams should not be modified.",
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  // 3. Check for duplicate name only if the name is actually changing
  const incomingName = name.trim();
  const nameIsChanging = team.name.toLowerCase() !== incomingName.toLowerCase();

  if (nameIsChanging) {
    const nameExists = await Team.exists({
      orgId,
      _id: { $ne: teamId },
      name: { $regex: `^${incomingName}$`, $options: "i" },
      isDeleted: false,
    });

    if (nameExists) {
      throw new ErrorHandler(
        "A team with this name already exists in the organization.",
        EXCEPTION_CODES.DUPLICATE_RESOURCE,
      );
    }
  }

  // 4. Apply updates
  team.name = incomingName;
  if (description !== undefined) {
    team.description = description ?? null;
  }
  team.updatedBy = userId;

  await team.save();
};

const updateTeamIcon = async ({ orgId, teamId, icon }) => {
  if (!icon) {
    throw new ErrorHandler(
      "Missing field - icon",
      EXCEPTION_CODES.MISSING_REQUIRED_FIELDS,
    );
  }

  const team = await Team.findOne({
    _id: teamId,
    orgId,
    isDeleted: false,
  });

  if (!team) {
    throw new ErrorHandler(
      "Team not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  if (team.isArchived) {
    throw new ErrorHandler(
      "Archived teams should not be modified.",
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  const { url, publicId } = await uploadIcon(icon.buffer, "team", {
    orgId,
    teamId,
  });

  team.icon = { url, publicId };
  await team.save();

  return { icon: team.icon.url };
};

const removeTeamIcon = async ({ orgId, teamId }) => {
  const team = await Team.findOne({
    _id: teamId,
    orgId,
    isDeleted: false,
  });

  if (!team) {
    throw new ErrorHandler(
      "Team not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  if (team.isArchived) {
    throw new ErrorHandler(
      "Archived teams should not be modified.",
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  if (!team.icon?.publicId) return;

  const oldPublicId = team.icon.publicId;

  team.icon = { url: null, publicId: null };
  await team.save();

  // Delete from Cloudinary after DB save succeeds
  // Non-fatal — log and move on if it fails
  try {
    await deleteCloudinaryFile(oldPublicId, CLOUDINARY_RESOURCE_TYPES.IMAGE);
  } catch (err) {
    console.warn(
      `Failed to delete team icon from Cloudinary. PublicId: ${oldPublicId}`,
      err,
    );
  }
};

const archiveTeam = async ({ orgId, teamId, userId }) => {
  const team = await Team.findOne({
    _id: teamId,
    orgId,
    isDeleted: false,
  });

  if (!team) {
    throw new ErrorHandler(
      "Team not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  if (team.isArchived) {
    throw new ErrorHandler(
      "Team is already archived.",
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  team.isArchived = true;
  team.archivedAt = new Date();
  team.archivedBy = userId;

  await team.save();
};

const unarchiveTeam = async ({ orgId, teamId }) => {
  const team = await Team.findOne({
    _id: teamId,
    orgId,
    isDeleted: false,
  });

  if (!team) {
    throw new ErrorHandler(
      "Team not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  if (!team.isArchived) {
    throw new ErrorHandler(
      "Team is not archived.",
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  team.isArchived = false;
  team.archivedAt = null;
  team.archivedBy = null;

  await team.save();
};

const addTeamMember = async ({
  orgId,
  teamId,
  userId,
  targetUserId,
  role = ORG_ROLES.TeamMember,
}) => {
  // 1. Fetch team, caller's memberships, target's org membership, and
  //    check if target is already a team member — all in parallel
  const [
    team,
    callerOrgMembership,
    callerTeamMembership,
    targetOrgMembership,
    existingTeamMembership,
  ] = await Promise.all([
    Team.findOne({
      _id: teamId,
      orgId,
      isDeleted: { $ne: true },
    }).lean(),

    Membership.findOne({
      userId,
      orgId,
      scope: MEMBER_SCOPES.ORG,
    }).lean(),

    Membership.findOne({
      userId,
      orgId,
      teamId,
      scope: MEMBER_SCOPES.TEAM,
    }).lean(),

    Membership.findOne({
      userId: targetUserId,
      orgId,
      scope: MEMBER_SCOPES.ORG,
    }).lean(),

    Membership.findOne({
      userId: targetUserId,
      orgId,
      teamId,
      scope: MEMBER_SCOPES.TEAM,
    }).lean(),
  ]);

  if (!team || !callerOrgMembership) {
    throw new ErrorHandler(
      "Team not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // 2. Archived teams cannot be modified
  if (team.isArchived) {
    throw new ErrorHandler(
      "Cannot add members to an archived team.",
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  // 3. Target must be an org member first
  if (!targetOrgMembership) {
    throw new ErrorHandler(
      "User must be a member of the organization before being added to a team.",
      EXCEPTION_CODES.INVALID_INPUT,
    );
  }

  // 4. Target must not already be a team member
  if (existingTeamMembership) {
    throw new ErrorHandler(
      "User is already a member of this team.",
      EXCEPTION_CODES.DUPLICATE_RESOURCE,
    );
  }

  // 5. Only org admins or team admins can add someone as TeamAdmin
  if (role === ORG_ROLES.TeamAdmin) {
    const callerIsOrgAdmin =
      callerOrgMembership.role === ORG_ROLES.OrgOwner ||
      callerOrgMembership.role === ORG_ROLES.OrgAdmin;

    const callerIsTeamAdmin =
      callerTeamMembership?.role === ORG_ROLES.TeamAdmin;

    if (!callerIsOrgAdmin && !callerIsTeamAdmin) {
      throw new ErrorHandler(
        "Only a team admin or org admin can add a member with the TeamAdmin role.",
        EXCEPTION_CODES.FORBIDDEN,
      );
    }
  }

  // 6. Add the team membership
  await Membership.create({
    userId: targetUserId,
    orgId,
    teamId,
    scope: MEMBER_SCOPES.TEAM,
    role,
    invitedBy: userId,
    joinedAt: new Date(),
  });

  // 7. Seed ReadState for all public non-archived channels in this team
  //    so the new member's unread cursor starts at the current high-water mark
  const publicChannels = await Channel.find({
    teamId,
    isPrivate: false,
    isArchived: false,
    isDeleted: false,
  })
    .select("_id")
    .lean();

  if (publicChannels.length > 0) {
    const publicChannelIds = publicChannels.map((c) => c._id);

    // Get the latest message ID per channel as the starting cursor
    const latestMessages = await Message.aggregate([
      {
        $match: {
          channelId: { $in: publicChannelIds },
          deletedAt: null,
        },
      },
      {
        // MongoDB ObjectIds are time-based, a larger _id generally means a newer document.
        $sort: { _id: -1 },
      },
      {
        $group: {
          _id: "$channelId",
          lastMessageId: { $first: "$_id" },
          lastMessageAt: { $first: "$createdAt" },
        },
      },
    ]);

    const latestMessageMap = new Map(
      latestMessages.map((m) => [m._id.toString(), m]),
    );

    const readStates = publicChannelIds.map((channelId) => {
      const latest = latestMessageMap.get(channelId.toString()) ?? null;

      return {
        userId: targetUserId,
        channelId,
        lastReadMessageId: latest?.lastMessageId ?? null,
        lastReadAt: latest ? latest.lastMessageAt : new Date(),
        unreadCount: 0,
        mentionCount: 0,
      };
    });

    await ReadState.insertMany(readStates, { ordered: false });
  }
};

const updateTeamMemberRole = async ({ orgId, teamId, membershipId, role }) => {
  // 1. Verify team exists and fetch the target membership + admin count in parallel
  const [team, targetMembership, adminCount] = await Promise.all([
    Team.findOne({
      _id: teamId,
      orgId,
      isDeleted: { $ne: true },
    }).lean(),

    Membership.findOne({
      _id: membershipId,
      teamId,
      orgId,
      scope: MEMBER_SCOPES.TEAM,
    }).lean(),

    Membership.countDocuments({
      teamId,
      orgId,
      scope: MEMBER_SCOPES.TEAM,
      role: ORG_ROLES.TeamAdmin,
    }),
  ]);

  if (!team) {
    throw new ErrorHandler(
      "Team not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // 2. Archived teams cannot be modified
  if (team.isArchived) {
    throw new ErrorHandler(
      "Cannot update members of an archived team.",
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  if (!targetMembership) {
    throw new ErrorHandler(
      "Team membership not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // 3. No-op if role is already the same
  if (targetMembership.role === role) return;

  // 4. Prevent removing the last admin
  if (
    targetMembership.role === ORG_ROLES.TeamAdmin &&
    role !== ORG_ROLES.TeamAdmin &&
    adminCount <= 1
  ) {
    throw new ErrorHandler(
      "This user is the only admin of the team. Assign another admin before changing their role.",
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  // 5. Update the role
  await Membership.updateOne({ _id: membershipId }, { $set: { role } });
};

const removeTeamMember = async ({ orgId, teamId, membershipId, userId }) => {
  // 1. Fetch team, target membership, and admin count in parallel
  const [team, targetMembership, adminCount] = await Promise.all([
    Team.findOne({
      _id: teamId,
      orgId,
      isDeleted: { $ne: true },
    }).lean(),

    Membership.findOne({
      _id: membershipId,
      teamId,
      orgId,
      scope: MEMBER_SCOPES.TEAM,
    }).lean(),

    Membership.countDocuments({
      teamId,
      orgId,
      scope: MEMBER_SCOPES.TEAM,
      role: ORG_ROLES.TeamAdmin,
    }),
  ]);

  if (!team) {
    throw new ErrorHandler(
      "Team not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // 2. Archived teams cannot be modified
  if (team.isArchived) {
    throw new ErrorHandler(
      "Cannot remove members from an archived team.",
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  if (!targetMembership) {
    throw new ErrorHandler(
      "Team membership not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // 3. Cannot remove yourself via this endpoint
  if (targetMembership.userId.equals(userId)) {
    throw new ErrorHandler(
      "You cannot remove yourself. Use the leave team action instead.",
      EXCEPTION_CODES.INVALID_INPUT,
    );
  }

  // 4. Cannot remove the last admin
  if (targetMembership.role === ORG_ROLES.TeamAdmin && adminCount <= 1) {
    throw new ErrorHandler(
      "Cannot remove the only admin of the team. Assign another admin first.",
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  // 5. Run shared cascade removal
  await executeCascadeRemoval({
    membershipId: targetMembership._id,
    userId: targetMembership.userId,
    teamId,
    orgId,
    actorId: userId,
  });
};

const leaveTeam = async ({ orgId, teamId, userId }) => {
  // 1. Fetch team, caller's membership, and admin count in parallel
  const [team, callerMembership, adminCount] = await Promise.all([
    Team.findOne({
      _id: teamId,
      orgId,
      isDeleted: { $ne: true },
    }).lean(),

    Membership.findOne({
      userId,
      teamId,
      orgId,
      scope: MEMBER_SCOPES.TEAM,
    }).lean(),

    Membership.countDocuments({
      teamId,
      orgId,
      scope: MEMBER_SCOPES.TEAM,
      role: ORG_ROLES.TeamAdmin,
    }),
  ]);

  if (!team) {
    throw new ErrorHandler(
      "Team not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // 2. Archived teams cannot be left
  if (team.isArchived) {
    throw new ErrorHandler(
      "Cannot leave an archived team.",
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  if (!callerMembership) {
    throw new ErrorHandler(
      "Team membership not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // 3. Prevent last admin from leaving
  if (callerMembership.role === ORG_ROLES.TeamAdmin && adminCount <= 1) {
    throw new ErrorHandler(
      "You are the only admin of this team. Assign another admin before leaving.",
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  // 4. Run cascade removal
  await executeCascadeRemoval({
    membershipId: callerMembership._id,
    userId,
    teamId,
    orgId,
    actorId: userId,
  });
};

//#endregion

//#region Internal Helpers
const executeCascadeRemoval = async ({
  membershipId,
  userId,
  teamId,
  orgId,
  actorId,
}) => {
  const now = new Date();

  // Phase 1: Resolve sole-moderator private channels
  // Find all channels in this team where the user is a moderator
  const userModMemberships = await Membership.find({
    userId,
    teamId,
    orgId,
    scope: MEMBER_SCOPES.CHANNEL,
    role: ORG_ROLES.ChannelModerator,
  }).lean();

  // Only run sole-mod resolution if user is a moderator in at least one channel
  if (userModMemberships.length > 0) {
    const userModChannelIds = userModMemberships.map((m) => m.channelId);

    const channelIdsWithAnotherMod = await Membership.distinct("channelId", {
      channelId: { $in: userModChannelIds },
      userId: { $ne: userId },
      scope: MEMBER_SCOPES.CHANNEL,
      role: ORG_ROLES.ChannelModerator,
    });

    const channelIdsWithAnotherModSet = new Set(
      channelIdsWithAnotherMod.map((id) => id.toString()),
    );

    const soleModChannelIds = userModChannelIds.filter(
      (id) => !channelIdsWithAnotherModSet.has(id.toString()),
    );

    for (const channelId of soleModChannelIds) {
      const nextSeniorMember = await Membership.findOne({
        channelId,
        userId: { $ne: userId },
        scope: MEMBER_SCOPES.CHANNEL,
      })
        .sort({ joinedAt: 1 })
        .lean();

      if (nextSeniorMember) {
        await Membership.updateOne(
          { _id: nextSeniorMember._id },
          {
            $set: { role: ORG_ROLES.ChannelModerator, updatedBy: actorId },
          },
        );
      } else {
        await Channel.updateOne(
          { _id: channelId, isArchived: false, isDeleted: false },
          { $set: { isArchived: true, archivedAt: now, archivedBy: actorId } },
        );
      }
    }
  }

  // Phase 2: Bulk remove all user's channel memberships in this team
  await Membership.deleteMany({
    userId,
    teamId,
    orgId,
    scope: MEMBER_SCOPES.CHANNEL,
  });

  // Delete Read States for all the channel in this team
  const teamChannelIds = await Channel.distinct("_id", {
    teamId,
    isDeleted: false,
  });

  await ReadState.deleteMany({
    userId,
    channelId: { $in: teamChannelIds },
  });

  // Phase 3: Delete the team membership
  await Membership.deleteOne({ _id: membershipId });
};
//#endregion

export const teamService = {
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
  leaveTeam,
  removeTeamMember,
};
