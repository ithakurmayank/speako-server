import { EXCEPTION_CODES } from "#constants/exceptionCodes.constants.js";
import { MESSAGE_TYPES } from "#constants/message.constants.js";
import { NOTIFICATION_TYPES } from "#constants/notifications.constants.js";
import { ORG_ROLES } from "#constants/roles.constants.js";
import { MEMBER_SCOPES } from "#constants/user.constants.js";
import { Channel } from "#models/channel.model.js";
import { Membership } from "#models/membership.model.js";
import { Message } from "#models/message.model.js";
import { Notification } from "#models/notification.model.js";
import { ReadState } from "#models/readState.model.js";
import { Team } from "#models/team.model.js";
import { User } from "#models/user.model.js";
import { ErrorHandler } from "#utils/errorHandler.util.js";
import {
  getOffsetPaginationValues,
  getPaginatedResponse,
} from "#utils/pagination.util.js";
import mongoose from "mongoose";

//#region GET services
const getChannel = async ({ orgId, teamId, channelId, userId }) => {
  // 1. Verify team exists and resolve caller's org + team roles in parallel
  const [team, callerOrgMembership, callerTeamMembership] = await Promise.all([
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
  ]);

  // Team not found or caller is not an org member
  if (!team || !callerOrgMembership) {
    throw new ErrorHandler(
      "Team not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  const callerIsAdmin =
    callerOrgMembership.role === ORG_ROLES.OrgOwner ||
    callerOrgMembership.role === ORG_ROLES.OrgAdmin ||
    callerTeamMembership?.role === ORG_ROLES.TeamAdmin;

  // 2. Fetch the channel
  const channel = await Channel.findOne({
    _id: channelId,
    teamId,
    orgId,
    isDeleted: false,
  }).lean();

  if (!channel) {
    throw new ErrorHandler(
      "Channel not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // 3. Non-admins cannot see a private channel they are not a member of
  if (channel.isPrivate && !callerIsAdmin) {
    const callerChannelMembership = await Membership.findOne({
      userId,
      channelId,
      teamId,
      orgId,
      scope: MEMBER_SCOPES.CHANNEL,
    }).lean();

    if (!callerChannelMembership) {
      throw new ErrorHandler(
        "Channel not found.",
        EXCEPTION_CODES.RESOURCE_NOT_FOUND,
      );
    }
  }

  // 4. Get member count
  // Public channels: all team members are implicit members so count team memberships
  // Private channels: only explicit channel memberships count
  const memberCount = channel.isPrivate
    ? await Membership.countDocuments({
        channelId,
        orgId,
        teamId,
        scope: MEMBER_SCOPES.CHANNEL,
      })
    : await Membership.countDocuments({
        teamId,
        orgId,
        scope: MEMBER_SCOPES.TEAM,
      });

  // 5. Shape the response
  return {
    id: channel._id,
    orgId: channel.orgId,
    teamId: channel.teamId,
    name: channel.name,
    description: channel.description ?? null,
    type: channel.type,
    isPrivate: channel.isPrivate,
    isArchived: channel.isArchived,
    archivedAt: channel.archivedAt ?? null,
    createdAt: channel.createdAt,
    memberCount,
  };
};

const getChannels = async ({ orgId, teamId, userId, query }) => {
  const { page, size, skip, limit } = getOffsetPaginationValues(query);
  const { search, isArchived, includePrivate } = query;

  // 1. Verify team exists and resolve caller's org + team roles in parallel
  const [team, callerOrgMembership, callerTeamMembership] = await Promise.all([
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
  ]);

  if (!team || !callerOrgMembership) {
    throw new ErrorHandler(
      "Team not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  const callerIsAdmin =
    callerOrgMembership.role === ORG_ROLES.OrgOwner ||
    callerOrgMembership.role === ORG_ROLES.OrgAdmin ||
    callerTeamMembership?.role === ORG_ROLES.TeamAdmin;

  // 2. Build the filter
  const filter = {
    teamId,
    orgId,
    isDeleted: false,
  };

  if (isArchived !== undefined) {
    filter.isArchived = isArchived === "true";
  }

  if (search?.trim()) {
    filter.name = { $regex: search.trim(), $options: "i" };
  }

  if (includePrivate === "false") {
    // Only public channels
    filter.isPrivate = false;
  } else if (!callerIsAdmin) {
    // Non-admins see public channels + private channels they are a member of
    const callerChannelIds = await Membership.distinct("channelId", {
      userId,
      teamId,
      orgId,
      scope: MEMBER_SCOPES.CHANNEL,
    });

    filter.$or = [
      { isPrivate: false },
      { isPrivate: true, _id: { $in: callerChannelIds } },
    ];
  }
  // Admins see everything — no extra filter needed

  // 3. Count + paginate
  const [totalCount, channels] = await Promise.all([
    Channel.countDocuments(filter),
    Channel.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
  ]);

  if (channels.length === 0) {
    return getPaginatedResponse({
      data: [],
      totalCount,
      pageNumber: page,
      pageSize: size,
    });
  }

  // 4. Back-fill caller's channel membership + read states for this page
  const pageChannelIds = channels.map((c) => c._id);

  const [myChannelMemberships, myReadStates, memberCounts] = await Promise.all([
    // Caller's explicit channel memberships (role, isMuted, joinedAt)
    Membership.find({
      userId,
      channelId: { $in: pageChannelIds },
      teamId,
      orgId,
      scope: MEMBER_SCOPES.CHANNEL,
    }).lean(),

    // Caller's unread + mention counts per channel
    ReadState.find({
      userId,
      channelId: { $in: pageChannelIds },
    })
      .select("channelId unreadCount mentionCount")
      .lean(),

    // Member count per channel
    // Public: count team members. Private: count channel members.
    Membership.aggregate([
      {
        $match: {
          $or: [
            // team-scoped for public channels
            { teamId: { $in: [teamId] }, orgId, scope: MEMBER_SCOPES.TEAM },
            // channel-scoped for private channels
            {
              channelId: { $in: pageChannelIds },
              orgId,
              scope: MEMBER_SCOPES.CHANNEL,
            },
          ],
        },
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$scope", MEMBER_SCOPES.CHANNEL] },
              "$channelId",
              "public", // all public channels share the same team member count
            ],
          },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const myMembershipsMap = new Map(
    myChannelMemberships.map((m) => [m.channelId.toString(), m]),
  );

  const myReadStatesMap = new Map(
    myReadStates.map((rs) => [rs.channelId.toString(), rs]),
  );

  // Extract public channel team member count from aggregation
  const publicMemberCount =
    memberCounts.find((m) => m._id === "public")?.count ?? 0;

  const privateMemberCountMap = new Map(
    memberCounts
      .filter((m) => m._id !== "public")
      .map((m) => [m._id.toString(), m.count]),
  );

  // 5. Shape the response
  const data = channels.map((channel) => {
    const membership = myMembershipsMap.get(channel._id.toString()) ?? null;
    const readState = myReadStatesMap.get(channel._id.toString()) ?? null;

    return {
      id: channel._id,
      orgId: channel.orgId,
      teamId: channel.teamId,
      name: channel.name,
      description: channel.description ?? null,
      type: channel.type,
      isPrivate: channel.isPrivate,
      isArchived: channel.isArchived,
      archivedAt: channel.archivedAt ?? null,
      createdAt: channel.createdAt,
      memberCount: channel.isPrivate
        ? (privateMemberCountMap.get(channel._id.toString()) ?? 0)
        : publicMemberCount,
      // Caller-specific fields
      role: membership?.role ?? null,
      isMuted: membership?.isMuted ?? null,
      joinedAt: membership?.joinedAt ?? null,
      unreadCount: readState?.unreadCount ?? 0,
      mentionCount: readState?.mentionCount ?? 0,
    };
  });

  return getPaginatedResponse({
    data,
    totalCount,
    pageNumber: page,
    pageSize: size,
  });
};

const getChannelMembers = async ({
  orgId,
  teamId,
  channelId,
  userId,
  query,
}) => {
  const { page, size, skip, limit } = getOffsetPaginationValues(query);

  // 1. Resolve caller's org + team roles and fetch channel in parallel
  const [callerOrgMembership, callerTeamMembership, channel] =
    await Promise.all([
      Membership.findOne({
        userId,
        orgId,
        scope: MEMBER_SCOPES.ORG,
      }).lean(),

      Membership.findOne({
        userId,
        teamId,
        orgId,
        scope: MEMBER_SCOPES.TEAM,
      }).lean(),

      Channel.findOne({
        _id: channelId,
        teamId,
        orgId,
        isDeleted: false,
      }).lean(),
    ]);

  if (!callerOrgMembership) {
    throw new ErrorHandler(
      "Channel not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  if (!channel) {
    throw new ErrorHandler(
      "Channel not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  const callerHasElevatedAccess =
    callerOrgMembership.role === ORG_ROLES.OrgOwner ||
    callerOrgMembership.role === ORG_ROLES.OrgAdmin ||
    callerTeamMembership?.role === ORG_ROLES.TeamAdmin;

  // 2. Build membership filter based on channel type
  //    Private: explicit channel memberships
  //    Public: inherited team memberships
  let membershipFilter;

  if (channel.isPrivate) {
    // Non-elevated callers must be an explicit channel member
    if (!callerHasElevatedAccess) {
      const callerChannelMembership = await Membership.findOne({
        userId,
        channelId,
        teamId,
        orgId,
        scope: MEMBER_SCOPES.CHANNEL,
      }).lean();

      if (!callerChannelMembership) {
        throw new ErrorHandler(
          "Channel not found.",
          EXCEPTION_CODES.RESOURCE_NOT_FOUND,
        );
      }
    }

    membershipFilter = {
      channelId,
      teamId,
      orgId,
      scope: MEMBER_SCOPES.CHANNEL,
    };
  } else {
    // Non-elevated callers must be a team member
    if (!callerHasElevatedAccess && !callerTeamMembership) {
      throw new ErrorHandler(
        "Channel not found.",
        EXCEPTION_CODES.RESOURCE_NOT_FOUND,
      );
    }

    membershipFilter = {
      teamId,
      orgId,
      scope: MEMBER_SCOPES.TEAM,
    };
  }

  // 3. Count + paginate memberships
  const [totalCount, memberships] = await Promise.all([
    Membership.countDocuments(membershipFilter),
    Membership.find(membershipFilter)
      .sort({ userId: 1 })
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

  // 4. Fetch user details for this page of members
  const userIds = memberships.map((m) => m.userId);

  const users = await User.find({ _id: { $in: userIds } })
    .select("_id name username icon")
    .lean();

  const usersMap = new Map(users.map((u) => [u._id.toString(), u]));

  // 5. Shape the response
  const data = memberships.map((m) => {
    const user = usersMap.get(m.userId.toString());

    return {
      membershipId: m._id,
      userId: m.userId,
      name: user?.name ?? null,
      username: user?.username ?? null,
      icon: user?.icon ?? null,
      // Private channels have explicit roles and isMuted on the membership
      // Public channels inherit team membership — use defaults
      role: channel.isPrivate ? m.role : null,
      isMuted: channel.isPrivate ? m.isMuted : null,
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
const createChannel = async ({
  orgId,
  teamId,
  userId,
  name,
  description,
  type = CHANNEL_TYPES.TEXT,
  isPrivate = false,
}) => {
  // 1. Verify team exists in org, is not archived, and caller is an org member
  const [team, callerOrgMembership] = await Promise.all([
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
  ]);

  if (!team || !callerOrgMembership) {
    throw new ErrorHandler(
      "Team not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  if (team.isArchived) {
    throw new ErrorHandler(
      "Cannot create channels in an archived team.",
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  // 2. Check for duplicate channel name within the team (case-insensitive)
  const nameExists = await Channel.exists({
    teamId,
    name: { $regex: `^${name.trim()}$`, $options: "i" },
    isDeleted: false,
  });

  if (nameExists) {
    throw new ErrorHandler(
      "A channel with this name already exists in the team.",
      EXCEPTION_CODES.DUPLICATE_RESOURCE,
    );
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      // 3. Create the channel
      const channel = await Channel.create(
        [
          {
            orgId,
            teamId,
            name: name.trim(),
            description: description ?? null,
            type,
            isPrivate,
            createdBy: userId,
          },
        ],
        { session },
      );

      const createdChannel = channel[0];

      // 4. Private channel — add creator as ChannelModerator and seed their ReadState
      if (isPrivate) {
        await Membership.create(
          [
            {
              userId,
              orgId,
              teamId,
              channelId: createdChannel._id,
              scope: MEMBER_SCOPES.CHANNEL,
              role: ORG_ROLES.ChannelModerator,
              invitedBy: userId,
              joinedAt: new Date(),
            },
          ],
          { session },
        );

        await ReadState.create(
          [
            {
              userId,
              channelId: createdChannel._id,
              lastReadMessageId: null, // new channel, no messages yet
              lastReadAt: new Date(),
              unreadCount: 0,
              mentionCount: 0,
            },
          ],
          { session },
        );
      } else {
        // 5. Public channel — seed ReadState for all current team members
        //    so no existing messages appear as unread for anyone
        const teamMemberIds = await Membership.distinct("userId", {
          teamId,
          orgId,
          scope: MEMBER_SCOPES.TEAM,
        }).session(session);

        if (teamMemberIds.length > 0) {
          const readStates = teamMemberIds.map((memberId) => ({
            userId: memberId,
            channelId: createdChannel._id,
            lastReadMessageId: null, // new channel, no messages yet
            lastReadAt: new Date(),
            unreadCount: 0,
            mentionCount: 0,
          }));

          await ReadState.insertMany(readStates, {
            ordered: false,
            session,
          });
        }
      }
    });
  } finally {
    await session.endSession();
  }
};

const updateChannel = async ({
  orgId,
  teamId,
  channelId,
  userId,
  name,
  description,
}) => {
  // 1. Fetch the channel
  const channel = await Channel.findOne({
    _id: channelId,
    teamId,
    orgId,
    isDeleted: false,
  });

  if (!channel) {
    throw new ErrorHandler(
      "Channel not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // 2. Archived channels cannot be edited
  if (channel.isArchived) {
    throw new ErrorHandler(
      "Archived channels cannot be edited.",
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  const incomingName = name.trim();
  const nameIsChanging =
    channel.name.toLowerCase() !== incomingName.toLowerCase();

  // 3. Name is changing — check for duplicates within the team
  if (nameIsChanging) {
    const nameExists = await Channel.exists({
      teamId,
      _id: { $ne: channelId },
      name: { $regex: `^${incomingName}$`, $options: "i" },
      isDeleted: false,
    });

    if (nameExists) {
      throw new ErrorHandler(
        "A channel with this name already exists in the team.",
        EXCEPTION_CODES.DUPLICATE_RESOURCE,
      );
    }

    // System message only needed when name changes
    await Message.create({
      channelId,
      senderId: userId,
      messageType: MESSAGE_TYPES.SYSTEM,
      content: `Channel has been renamed from ${channel.name} to ${incomingName}.`,
    });
  }

  // 4. Apply all updates — always runs regardless of what changed
  channel.name = incomingName;
  if (description !== undefined) {
    channel.description = description ?? null;
  }
  channel.updatedBy = userId;

  await channel.save();
};

const archiveChannel = async ({ orgId, teamId, channelId, userId }) => {
  // 1. Fetch channel and its team in parallel
  const [channel, team] = await Promise.all([
    Channel.findOne({
      _id: channelId,
      teamId,
      orgId,
      isDeleted: false,
    }),

    Team.findOne({
      _id: teamId,
      orgId,
      isDeleted: { $ne: true },
    }).lean(),
  ]);

  if (!channel) {
    throw new ErrorHandler(
      "Channel not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // 2. Channel must not already be archived
  if (channel.isArchived) {
    throw new ErrorHandler(
      "Channel is already archived.",
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  // 3. Parent team must not be archived
  if (team?.isArchived) {
    throw new ErrorHandler(
      "Archived teams should not be modified.",
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  // 4. Archive channel and create info message
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      channel.isArchived = true;
      channel.archivedAt = new Date();
      channel.archivedBy = userId;
      await channel.save({ session });

      await Message.create(
        [
          {
            channelId,
            senderId: userId,
            messageType: MESSAGE_TYPES.SYSTEM,
            content: "Channel has been archived.",
          },
        ],
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
};

const unarchiveChannel = async ({ orgId, teamId, channelId, userId }) => {
  // 1. Fetch channel and its team in parallel
  const [channel, team] = await Promise.all([
    Channel.findOne({
      _id: channelId,
      teamId,
      orgId,
      isDeleted: false,
    }),

    Team.findOne({
      _id: teamId,
      orgId,
      isDeleted: { $ne: true },
    }).lean(),
  ]);

  if (!channel) {
    throw new ErrorHandler(
      "Channel not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // 2. Parent team must not be archived
  if (team?.isArchived) {
    throw new ErrorHandler(
      "Archived teams should not be modified.",
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  // 3. Channel must actually be archived to unarchive it
  if (!channel.isArchived) {
    throw new ErrorHandler(
      "Channel is not archived.",
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  // 4. Unarchive the channel and create system message
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      channel.isArchived = false;
      channel.archivedAt = null;
      channel.archivedBy = null;
      await channel.save({ session });

      await Message.create(
        [
          {
            channelId,
            senderId: userId,
            messageType: MESSAGE_TYPES.SYSTEM,
            content: "Channel has been un-archived.",
          },
        ],
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
};

const addChannelMember = async ({
  orgId,
  teamId,
  channelId,
  userId,
  targetUserId,
  role = ORG_ROLES.ChannelMember,
}) => {
  // 1. Fetch channel, team, caller's memberships, target's team membership,
  //    and check if target is already a channel member — all in parallel
  const [
    channel,
    team,
    callerOrgMembership,
    callerTeamMembership,
    targetTeamMembership,
    existingChannelMembership,
  ] = await Promise.all([
    Channel.findOne({
      _id: channelId,
      teamId,
      orgId,
      isDeleted: false,
    }).lean(),

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
      teamId,
      orgId,
      scope: MEMBER_SCOPES.TEAM,
    }).lean(),

    Membership.findOne({
      userId: targetUserId,
      teamId,
      orgId,
      scope: MEMBER_SCOPES.TEAM,
    }).lean(),

    Membership.findOne({
      userId: targetUserId,
      channelId,
      teamId,
      orgId,
      scope: MEMBER_SCOPES.CHANNEL,
    }).lean(),
  ]);

  if (!channel || !callerOrgMembership) {
    throw new ErrorHandler(
      "Channel not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // 2. Parent team must not be archived
  if (team?.isArchived) {
    throw new ErrorHandler(
      "Cannot add members to an archived team channel.",
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  // 3. Channel must not be archived
  if (channel.isArchived) {
    throw new ErrorHandler(
      "Cannot add members to an archived channel.",
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  // 4. Only private channels have explicit members
  if (!channel.isPrivate) {
    throw new ErrorHandler(
      "Public channels automatically include all team members.",
      EXCEPTION_CODES.INVALID_INPUT,
    );
  }

  // 5. Target must be a team member first
  if (!targetTeamMembership) {
    throw new ErrorHandler(
      "User must be a team member before being added to a channel.",
      EXCEPTION_CODES.INVALID_INPUT,
    );
  }

  // 6. Target must not already be a channel member
  if (existingChannelMembership) {
    throw new ErrorHandler(
      "User is already a member of this channel.",
      EXCEPTION_CODES.DUPLICATE_RESOURCE,
    );
  }

  // 7. Only team admins or org admins can assign the ChannelModerator role
  if (role === ORG_ROLES.ChannelModerator) {
    const callerIsAdmin =
      callerOrgMembership.role === ORG_ROLES.OrgOwner ||
      callerOrgMembership.role === ORG_ROLES.OrgAdmin ||
      callerTeamMembership?.role === ORG_ROLES.TeamAdmin;

    if (!callerIsAdmin) {
      throw new ErrorHandler(
        "Only a team admin or org admin can assign the ChannelModerator role.",
        EXCEPTION_CODES.FORBIDDEN,
      );
    }
  }

  // 8. Add channel membership, seed ReadState, and create notification in parallel
  const latestMessage = await Message.findOne({
    channelId,
    deletedAt: null,
  })
    .sort({ _id: -1 })
    .select("_id createdAt")
    .lean();

  await Promise.all([
    Membership.create({
      userId: targetUserId,
      orgId,
      teamId,
      channelId,
      scope: MEMBER_SCOPES.CHANNEL,
      role,
      invitedBy: userId,
      joinedAt: new Date(),
    }),

    ReadState.create({
      userId: targetUserId,
      channelId,
      lastReadMessageId: latestMessage?._id ?? null,
      lastReadAt: latestMessage ? latestMessage.createdAt : new Date(),
      unreadCount: 0,
      mentionCount: 0,
    }),

    Notification.create({
      recipientId: targetUserId,
      actorId: userId,
      type: NOTIFICATION_TYPES.ADDED_TO_CHANNEL,
      channelId,
      teamId,
      isRead: false,
    }),
  ]);
};

const updateChannelMemberRole = async ({
  orgId,
  teamId,
  channelId,
  membershipId,
  role,
}) => {
  // 1. Fetch channel, team, target membership and moderator count in parallel
  const [channel, team, targetMembership, moderatorCount] = await Promise.all([
    Channel.findOne({
      _id: channelId,
      teamId,
      orgId,
      isDeleted: false,
    }).lean(),

    Team.findOne({
      _id: teamId,
      orgId,
      isDeleted: { $ne: true },
    }).lean(),

    Membership.findOne({
      _id: membershipId,
      channelId,
      teamId,
      orgId,
      scope: MEMBER_SCOPES.CHANNEL,
    }).lean(),

    Membership.countDocuments({
      channelId,
      teamId,
      orgId,
      scope: MEMBER_SCOPES.CHANNEL,
      role: ORG_ROLES.ChannelModerator,
    }),
  ]);

  if (!channel) {
    throw new ErrorHandler(
      "Channel not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // 2. Parent team must not be archived
  if (team?.isArchived) {
    throw new ErrorHandler(
      "Cannot update member roles in an archived team channel.",
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  // 3. Channel must not be archived
  if (channel.isArchived) {
    throw new ErrorHandler(
      "Cannot update member roles in an archived channel.",
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  // 4. Public channels don't have explicit roles
  if (!channel.isPrivate) {
    throw new ErrorHandler(
      "Public channels do not support custom member roles.",
      EXCEPTION_CODES.INVALID_INPUT,
    );
  }

  if (!targetMembership) {
    throw new ErrorHandler(
      "Channel membership not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // 5. No-op if role is already the same
  if (targetMembership.role === role) return;

  // 6. Prevent removing the last moderator
  if (
    targetMembership.role === ORG_ROLES.ChannelModerator &&
    role !== ORG_ROLES.ChannelModerator &&
    moderatorCount <= 1
  ) {
    throw new ErrorHandler(
      "This user is the only moderator of the channel. Assign another moderator before changing their role.",
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  // 7. Update the role
  await Membership.updateOne({ _id: membershipId }, { $set: { role } });
};

const leaveChannel = async ({ orgId, teamId, channelId, userId }) => {
  // 1. Fetch channel, team, caller's membership and moderator count in parallel
  const [channel, team, callerMembership, moderatorCount] = await Promise.all([
    Channel.findOne({
      _id: channelId,
      teamId,
      orgId,
      isDeleted: false,
    }).lean(),

    Team.findOne({
      _id: teamId,
      orgId,
      isDeleted: { $ne: true },
    }).lean(),

    Membership.findOne({
      userId,
      channelId,
      teamId,
      orgId,
      scope: MEMBER_SCOPES.CHANNEL,
    }).lean(),

    Membership.countDocuments({
      channelId,
      teamId,
      orgId,
      scope: MEMBER_SCOPES.CHANNEL,
      role: ORG_ROLES.ChannelModerator,
    }),
  ]);

  if (!channel) {
    throw new ErrorHandler(
      "Channel not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // 2. Parent team must not be archived
  if (team?.isArchived) {
    throw new ErrorHandler(
      "Cannot leave a channel in an archived team.",
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  // 3. Channel must not be archived
  if (channel.isArchived) {
    throw new ErrorHandler(
      "Cannot leave an archived channel.",
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  // 4. Public channels don't have explicit memberships to leave
  if (!channel.isPrivate) {
    throw new ErrorHandler(
      "Public channels do not support leaving individually.",
      EXCEPTION_CODES.INVALID_INPUT,
    );
  }

  if (!callerMembership) {
    throw new ErrorHandler(
      "Channel membership not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // 5. Prevent last moderator from leaving
  if (
    callerMembership.role === ORG_ROLES.ChannelModerator &&
    moderatorCount <= 1
  ) {
    throw new ErrorHandler(
      "Cannot leave as the only moderator of the channel. Assign another moderator first.",
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  // 6. Delete the channel membership
  await Membership.deleteOne({ _id: callerMembership._id });
};

const removeChannelMember = async ({
  orgId,
  teamId,
  channelId,
  membershipId,
  userId,
}) => {
  // 1. Fetch channel, team, target membership and moderator count in parallel
  const [channel, team, targetMembership, moderatorCount] = await Promise.all([
    Channel.findOne({
      _id: channelId,
      teamId,
      orgId,
      isDeleted: false,
    }).lean(),

    Team.findOne({
      _id: teamId,
      orgId,
      isDeleted: { $ne: true },
    }).lean(),

    Membership.findOne({
      _id: membershipId,
      channelId,
      teamId,
      orgId,
      scope: MEMBER_SCOPES.CHANNEL,
    }).lean(),

    Membership.countDocuments({
      channelId,
      teamId,
      orgId,
      scope: MEMBER_SCOPES.CHANNEL,
      role: ORG_ROLES.ChannelModerator,
    }),
  ]);

  if (!channel) {
    throw new ErrorHandler(
      "Channel not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // 2. Parent team must not be archived
  if (team?.isArchived) {
    throw new ErrorHandler(
      "Cannot remove members from an archived team channel.",
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  // 3. Channel must not be archived
  if (channel.isArchived) {
    throw new ErrorHandler(
      "Cannot remove members from an archived channel.",
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  // 4. Public channels don't have explicit memberships to remove
  if (!channel.isPrivate) {
    throw new ErrorHandler(
      "Public channels do not support removing individual members.",
      EXCEPTION_CODES.INVALID_INPUT,
    );
  }

  if (!targetMembership) {
    throw new ErrorHandler(
      "Channel membership not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // 5. Cannot remove yourself via this endpoint
  if (targetMembership.userId.equals(userId)) {
    throw new ErrorHandler(
      "You cannot remove yourself. Use the leave channel action instead.",
      EXCEPTION_CODES.INVALID_INPUT,
    );
  }

  // 6. Cannot remove the last moderator
  if (
    targetMembership.role === ORG_ROLES.ChannelModerator &&
    moderatorCount <= 1
  ) {
    throw new ErrorHandler(
      "Cannot remove the only moderator of the channel. Assign another moderator first.",
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  // 7. Delete the channel membership
  await Membership.deleteOne({ _id: membershipId });
};

//#endregion

export const channelService = {
  getChannel,
  getChannels,
  getChannelMembers,
  createChannel,
  updateChannel,
  archiveChannel,
  unarchiveChannel,
  addChannelMember,
  updateChannelMemberRole,
  leaveChannel,
  removeChannelMember,
};
