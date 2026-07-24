import {
  CONVERSATION_TYPES,
  MAX_GROUP_PARTICIPANTS,
  MIN_GROUP_PARTICIPANTS,
} from "#constants/conversation.constants.js";
import { EXCEPTION_CODES } from "#constants/exceptionCodes.constants.js";
import { CLOUDINARY_RESOURCE_TYPES } from "#constants/fileTypes.constants.js";
import { NOTIFICATION_TYPES } from "#constants/notifications.constants.js";
import { GROUP_ROLES } from "#constants/roles.constants.js";
import { deleteCloudinaryFile, uploadIcon } from "#lib/cloudinary.lib.js";
import { Conversation } from "#models/conversation.model.js";
import { ConversationParticipant } from "#models/conversationParticipant.model.js";
import { Membership } from "#models/membership.model.js";
import { Message } from "#models/message.model.js";
import { ReadState } from "#models/readState.model.js";
import { User } from "#models/user.model.js";
import { ErrorHandler } from "#utils/errorHandler.util.js";
import {
  getOffsetPaginationValues,
  getPaginatedResponse,
} from "#utils/pagination.util.js";
import mongoose from "mongoose";

//#region GET services
const getConversations = async ({ userId, query }) => {
  const { page, size, skip, limit } = getOffsetPaginationValues(query);

  // 1. Build filter — caller must be a participant in the conversation
  //    Direct: caller is one of the two participants
  //    Group: caller has an active (not left) participant record
  const filter = {
    isDeleted: false,
    $or: [
      // Direct conversations
      {
        type: CONVERSATION_TYPES.DIRECT,
        $or: [
          { directParticipantAId: userId },
          { directParticipantBId: userId },
        ],
      },
      // Group conversations where caller hasn't left
      {
        type: CONVERSATION_TYPES.GROUP,
        _id: {
          $in: await ConversationParticipant.distinct("conversationId", {
            userId,
            hasLeft: false,
          }),
        },
      },
    ],
  };

  // 2. Count + paginate
  const [totalCount, conversations] = await Promise.all([
    Conversation.countDocuments(filter),
    Conversation.find(filter)
      .sort({ lastMessageAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  if (conversations.length === 0) {
    return getPaginatedResponse({
      data: [],
      totalCount,
      pageNumber: page,
      pageSize: size,
    });
  }

  const conversationIds = conversations.map((c) => c._id);

  // 3. Fetch all related data in parallel
  const directConversations = conversations.filter(
    (c) => c.type === CONVERSATION_TYPES.DIRECT,
  );

  const peerUserIds = directConversations.map((c) =>
    c.directParticipantAId.equals(userId)
      ? c.directParticipantBId
      : c.directParticipantAId,
  );

  const [callerParticipants, readStates, activeParticipantCounts, peerUsers] =
    await Promise.all([
      // Caller's participant record for group conversations (role, joinedAt)
      ConversationParticipant.find({
        conversationId: { $in: conversationIds },
        userId,
        hasLeft: false,
      })
        .select("conversationId role joinedAt")
        .lean(),

      // Caller's read states (unreadCount, mentionCount)
      ReadState.find({
        conversationId: { $in: conversationIds },
        userId,
      })
        .select("conversationId unreadCount mentionCount")
        .lean(),

      // Active participant count per group conversation
      ConversationParticipant.aggregate([
        {
          $match: {
            conversationId: { $in: conversationIds },
            hasLeft: false,
          },
        },
        {
          $group: {
            _id: "$conversationId",
            count: { $sum: 1 },
          },
        },
      ]),

      // Peer user details for direct conversations
      User.find({ _id: { $in: peerUserIds } })
        .select("_id name username icon")
        .lean(),
    ]);

  const callerParticipantsMap = new Map(
    callerParticipants.map((p) => [p.conversationId.toString(), p]),
  );

  const readStatesMap = new Map(
    readStates.map((rs) => [rs.conversationId.toString(), rs]),
  );

  const activeParticipantCountMap = new Map(
    activeParticipantCounts.map((a) => [a._id.toString(), a.count]),
  );

  const peerUsersMap = new Map(peerUsers.map((u) => [u._id.toString(), u]));

  // 4. Shape the response
  const data = conversations.map((conversation) => {
    const conversationIdStr = conversation._id.toString();
    const isDirect = conversation.type === CONVERSATION_TYPES.DIRECT;

    const callerParticipant =
      callerParticipantsMap.get(conversationIdStr) ?? null;
    const readState = readStatesMap.get(conversationIdStr) ?? null;

    // For direct conversations, find the peer user
    let peer = null;
    if (isDirect) {
      const peerUserId = conversation.directParticipantAId.equals(userId)
        ? conversation.directParticipantBId
        : conversation.directParticipantAId;

      const peerUser = peerUsersMap.get(peerUserId.toString()) ?? null;

      if (peerUser) {
        peer = {
          userId: peerUser._id,
          name: peerUser.name,
          username: peerUser.username,
          icon: peerUser.icon ?? null,
        };
      }
    }

    return {
      id: conversation._id,
      type: conversation.type,
      // Group only
      name: isDirect ? null : conversation.name,
      logo: isDirect ? null : (conversation.logo ?? null),
      participantCount: isDirect
        ? 2
        : (activeParticipantCountMap.get(conversationIdStr) ?? 0),
      createdAt: conversation.createdAt,
      lastMessageAt: conversation.lastMessageAt ?? null,
      unreadCount: readState?.unreadCount ?? 0,
      mentionCount: readState?.mentionCount ?? 0,
      // Caller-specific — only meaningful for group conversations
      role: isDirect ? null : (callerParticipant?.role ?? null),
      joinedAt: isDirect ? null : (callerParticipant?.joinedAt ?? null),
      // Direct only
      peer,
    };
  });

  return getPaginatedResponse({
    data,
    totalCount,
    pageNumber: page,
    pageSize: size,
  });
};

const lookupDirectConversation = async ({ userId, targetUserId }) => {
  // 1. Cannot open a DM with yourself
  if (userId.equals(targetUserId)) {
    throw new ErrorHandler(
      "You cannot open a Direct conversation with yourself.",
      EXCEPTION_CODES.INVALID_INPUT,
    );
  }

  // 2. Fetch target user and check for existing DM in parallel
  //    Normalize participant order the same way the schema pre-validate hook does
  //    so the lookup matches the stored document correctly
  const [a, b] = [userId.toString(), targetUserId.toString()].sort();
  const [directParticipantAId, directParticipantBId] =
    a === userId.toString() ? [userId, targetUserId] : [targetUserId, userId];

  const [targetUser, existingConversation] = await Promise.all([
    User.findOne({
      _id: targetUserId,
      isDeleted: { $ne: true },
    })
      .select("_id name username icon")
      .lean(),

    Conversation.findOne({
      type: CONVERSATION_TYPES.DIRECT,
      directParticipantAId,
      directParticipantBId,
      isDeleted: false,
    }).lean(),
  ]);

  if (!targetUser) {
    throw new ErrorHandler(
      "User not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // 3. Shape the response
  return {
    conversationId: existingConversation?._id ?? null,
    hasExistingConversation: !!existingConversation,
    peer: {
      userId: targetUser._id,
      name: targetUser.name,
      username: targetUser.username,
      icon: targetUser.icon ?? null,
    },
  };
};

const getConversation = async ({ conversationId, userId }) => {
  // 1. Fetch conversation — caller must be a participant
  const conversation = await Conversation.findOne({
    _id: conversationId,
    isDeleted: false,
    $or: [
      // Direct: caller is one of the two fixed participants
      {
        type: CONVERSATION_TYPES.DIRECT,
        $or: [
          { directParticipantAId: userId },
          { directParticipantBId: userId },
        ],
      },
      // Group: caller has an active participant record
      {
        type: CONVERSATION_TYPES.GROUP,
        _id: {
          $in: await ConversationParticipant.distinct("conversationId", {
            userId,
            hasLeft: false,
          }),
        },
      },
    ],
  }).lean();

  if (!conversation) {
    throw new ErrorHandler(
      "Conversation not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  const isDirect = conversation.type === CONVERSATION_TYPES.DIRECT;

  // 2. Fetch all related data in parallel
  const peerUserId = isDirect
    ? conversation.directParticipantAId.equals(userId)
      ? conversation.directParticipantBId
      : conversation.directParticipantAId
    : null;

  const [callerParticipant, readState, activeParticipantCount, peerUser] =
    await Promise.all([
      // Caller's participant record — only meaningful for group conversations
      isDirect
        ? Promise.resolve(null)
        : ConversationParticipant.findOne({
            conversationId,
            userId,
            hasLeft: false,
          })
            .select("role joinedAt")
            .lean(),

      // Caller's read state
      ReadState.findOne({
        conversationId,
        userId,
      })
        .select("unreadCount mentionCount")
        .lean(),

      // Active participant count — only needed for group conversations
      isDirect
        ? Promise.resolve(null)
        : ConversationParticipant.countDocuments({
            conversationId,
            hasLeft: false,
          }),

      // Peer user details — only needed for direct conversations
      isDirect
        ? User.findOne({ _id: peerUserId, isDeleted: { $ne: true } })
            .select("_id name username icon")
            .lean()
        : Promise.resolve(null),
    ]);

  // 3. Shape the response
  return {
    id: conversation._id,
    type: conversation.type,
    // Group only
    name: isDirect ? null : conversation.name,
    logo: isDirect ? null : (conversation.logo ?? null),
    participantCount: isDirect ? 2 : (activeParticipantCount ?? 0),
    createdAt: conversation.createdAt,
    lastMessageAt: conversation.lastMessageAt ?? null,
    unreadCount: readState?.unreadCount ?? 0,
    mentionCount: readState?.mentionCount ?? 0,
    // Caller-specific — only meaningful for group conversations
    role: isDirect ? null : (callerParticipant?.role ?? null),
    joinedAt: isDirect ? null : (callerParticipant?.joinedAt ?? null),
    // Direct only
    peer:
      isDirect && peerUser
        ? {
            userId: peerUser._id,
            name: peerUser.name,
            username: peerUser.username,
            icon: peerUser.icon ?? null,
          }
        : null,
  };
};

const getParticipants = async ({ conversationId, userId, query }) => {
  const { page, size, skip, limit } = getOffsetPaginationValues(query);

  // 1. Verify it's a group conversation the caller belongs to
  const conversation = await Conversation.findOne({
    _id: conversationId,
    isDeleted: false,
  }).lean();

  const isParticipant = await ConversationParticipant.exists({
    conversationId,
    userId,
    hasLeft: false,
  });

  if (!conversation || !isParticipant) {
    throw new ErrorHandler(
      "Conversation not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  if (conversation.type !== CONVERSATION_TYPES.GROUP) {
    throw new ErrorHandler(
      "This operation is only allowed for Group conversations.",
      EXCEPTION_CODES.INVALID_INPUT,
    );
  }

  // 2. Count + paginate active participants
  const participantFilter = {
    conversationId,
    hasLeft: false,
  };

  const [totalCount, participants] = await Promise.all([
    ConversationParticipant.countDocuments(participantFilter),
    ConversationParticipant.find(participantFilter)
      .sort({ joinedAt: 1, _id: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  if (participants.length === 0) {
    return getPaginatedResponse({
      data: [],
      totalCount,
      pageNumber: page,
      pageSize: size,
    });
  }

  // 3. Fetch user details for this page of participants
  const userIds = participants.map((p) => p.userId);

  const users = await User.find({ _id: { $in: userIds } })
    .select("_id name username icon")
    .lean();

  const usersMap = new Map(users.map((u) => [u._id.toString(), u]));

  // 4. Shape the response
  const data = participants.map((participant) => {
    const user = usersMap.get(participant.userId.toString());

    return {
      participantId: participant._id,
      userId: participant.userId,
      name: user?.name ?? null,
      username: user?.username ?? null,
      icon: user?.icon ?? null,
      role: participant.role,
      joinedAt: participant.joinedAt,
      rejoinedAt: participant.rejoinedAt ?? null,
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
const createDirectConversation = async ({ userId, targetUserId }) => {
  // 1. Cannot start a DM with yourself
  if (userId.equals(targetUserId)) {
    throw new ErrorHandler(
      "You cannot start a Direct conversation with yourself.",
      EXCEPTION_CODES.INVALID_INPUT,
    );
  }

  // 2. Normalize participant order — same logic as the schema pre-validate hook
  const [a, b] = [userId.toString(), targetUserId.toString()].sort();
  const directParticipantAId = a === userId.toString() ? userId : targetUserId;
  const directParticipantBId = a === userId.toString() ? targetUserId : userId;

  // 3. Return existing conversation if one already exists
  const existing = await Conversation.findOne({
    type: CONVERSATION_TYPES.DIRECT,
    directParticipantAId,
    directParticipantBId,
    isDeleted: false,
  }).lean();

  if (existing) {
    return getConversation({ conversationId: existing._id, userId });
  }

  // 4. Verify target user exists
  const targetUser = await User.exists({
    _id: targetUserId,
    isDeleted: { $ne: true },
  });

  if (!targetUser) {
    throw new ErrorHandler(
      "User not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // 5. Create conversation + ReadStates + notification atomically
  //    If any write fails everything rolls back — no orphaned conversations
  //    with missing ReadStates
  let conversationId;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const [conversation] = await Conversation.create(
        [
          {
            type: CONVERSATION_TYPES.DIRECT,
            directParticipantAId,
            directParticipantBId,
            createdBy: userId,
          },
        ],
        { session },
      );

      conversationId = conversation._id;

      await ReadState.insertMany(
        [
          {
            userId,
            conversationId,
            lastReadMessageId: null,
            lastReadAt: new Date(),
            unreadCount: 0,
            mentionCount: 0,
          },
          {
            userId: targetUserId,
            conversationId,
            lastReadMessageId: null,
            lastReadAt: new Date(),
            unreadCount: 0,
            mentionCount: 0,
          },
        ],
        { session },
      );

      await Notification.create(
        [
          {
            recipientId: targetUserId,
            actorId: userId,
            type: NOTIFICATION_TYPES.DM,
            conversationId,
            isRead: false,
          },
        ],
        { session },
      );
    });
  } catch (err) {
    // 6. Race condition — another request created the same DM concurrently
    //    MongoDB unique index throws error code 11000 on duplicate key
    if (err.code === 11000 && err.message.includes("directParticipantAId")) {
      const race = await Conversation.findOne({
        type: CONVERSATION_TYPES.DIRECT,
        directParticipantAId,
        directParticipantBId,
        isDeleted: false,
      }).lean();

      //If for any reason conversation was created and deleted within a very small timeframe, then throw original error.
      if (!race) throw err;

      //As conversation already exists, return existing conversation
      conversationId = race._id;
    } else {
      throw err;
    }
  } finally {
    await session.endSession();
  }

  // 7. Return the full conversation shape
  return getConversation({ conversationId, userId });
};

const createGroupConversation = async ({
  userId,
  name,
  participantUserIds,
}) => {
  // 1. Caller must not include themselves in the participant list
  if (
    participantUserIds.map((id) => id.toString()).includes(userId.toString())
  ) {
    throw new ErrorHandler(
      "Do not include yourself in participantUserIds — you are added automatically as GroupAdmin.",
      EXCEPTION_CODES.INVALID_INPUT,
    );
  }

  // 2. Deduplicate participant IDs
  const normalizedParticipantIds = [
    ...new Set(participantUserIds.map((id) => id.toString())),
  ];

  // 3. Verify all participants exist
  const foundCount = await User.countDocuments({
    _id: { $in: normalizedParticipantIds },
    isDeleted: { $ne: true },
  });

  if (foundCount !== normalizedParticipantIds.length) {
    throw new ErrorHandler(
      "One or more participants were not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // 4. All participant IDs including the creator
  const allParticipantIds = [...normalizedParticipantIds, userId.toString()];
  const now = new Date();

  // 5. Create conversation, participants, ReadStates and notifications atomically
  let conversationId;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Create the group conversation
      const [conversation] = await Conversation.create(
        [
          {
            type: CONVERSATION_TYPES.GROUP,
            name: name.trim(),
            createdBy: userId,
          },
        ],
        { session },
      );

      conversationId = conversation._id;

      // Add all participants — invited users as GroupMember, creator as GroupAdmin
      const participantDocs = [
        // Invited participants
        ...normalizedParticipantIds.map((participantId) => ({
          conversationId,
          userId: participantId,
          role: GROUP_ROLES.GroupMember,
          addedBy: userId,
          joinedAt: now,
        })),
        // Creator as GroupAdmin
        {
          conversationId,
          userId,
          role: GROUP_ROLES.GroupAdmin,
          addedBy: userId,
          joinedAt: now,
        },
      ];

      await ConversationParticipant.insertMany(participantDocs, { session });

      // Seed ReadState for every participant — new conversation, no messages yet
      const readStateDocs = allParticipantIds.map((participantId) => ({
        userId: participantId,
        conversationId,
        lastReadMessageId: null,
        lastReadAt: now,
        unreadCount: 0,
        mentionCount: 0,
      }));

      await ReadState.insertMany(readStateDocs, { session });

      // Notify all non-creator participants they were added to a group
      const notificationDocs = normalizedParticipantIds.map(
        (participantId) => ({
          recipientId: participantId,

          actorId: userId,
          type: NOTIFICATION_TYPES.ADDED_TO_GROUP,
          conversationId,
          preview: name.trim(),
          isRead: false,
        }),
      );

      if (notificationDocs.length > 0) {
        await Notification.insertMany(notificationDocs, { session });
      }
    });
  } finally {
    await session.endSession();
  }

  // 6. Return the full conversation shape
  return getConversation({ conversationId, userId });
};

const updateGroupConversationLogo = async ({
  conversationId,
  userId,
  logo,
}) => {
  // 1. Validate file presence
  if (!logo) {
    throw new ErrorHandler(
      "Missing field - logo",
      EXCEPTION_CODES.MISSING_REQUIRED_FIELDS,
    );
  }

  // 2. Fetch the conversation — caller must be an active participant
  const conversation = await Conversation.findOne({
    _id: conversationId,
    type: CONVERSATION_TYPES.GROUP,
    isDeleted: false,
  }).lean();

  const isParticipant = await ConversationParticipant.exists({
    conversationId,
    userId,
    hasLeft: false,
  });

  if (!conversation || !isParticipant) {
    throw new ErrorHandler(
      "Conversation not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // 3. Upload to Cloudinary — overwrites existing logo at the same path
  const { url, publicId } = await uploadIcon(logo.buffer, "group", {
    conversationId,
  });

  // 4. Persist new logo and create system message atomically
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      conversation.logo = { url, publicId };
      await conversation.save({ session });

      await Message.create(
        [
          {
            conversationId,
            senderId: userId,
            isSystem: true,
            content: "Group icon has been changed.",
          },
        ],
        { session },
      );
    });
  } catch (err) {
    // 5. DB write failed — clean up the uploaded Cloudinary asset
    try {
      await deleteCloudinaryFile(publicId, CLOUDINARY_RESOURCE_TYPES.IMAGE);
    } catch (cloudinaryErr) {
      console.warn(
        `Failed to delete conversation logo from Cloudinary. PublicId: ${publicId}`,
        cloudinaryErr,
      );
    }

    throw err;
  } finally {
    await session.endSession();
  }

  return { logo: conversation.logo.url };
};

const updateGroupConversation = async ({ conversationId, userId, name }) => {
  // 1. Fetch the conversation — caller must be an active participant
  const conversation = await Conversation.findOne({
    _id: conversationId,
    isDeleted: false,
  });

  const isParticipant = await ConversationParticipant.exists({
    conversationId,
    userId,
    hasLeft: false,
  });

  if (!conversation || !isParticipant) {
    throw new ErrorHandler(
      "Conversation not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // 2. Only group conversations can be renamed
  if (conversation.type !== CONVERSATION_TYPES.GROUP) {
    throw new ErrorHandler(
      "Only Group conversations can be renamed.",
      EXCEPTION_CODES.INVALID_INPUT,
    );
  }

  // 3. No-op if name hasn't changed
  const incomingName = name.trim();
  if (conversation.name.toLowerCase() === incomingName.toLowerCase()) return;

  // 4. Rename + system message atomically
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      conversation.name = incomingName;
      conversation.updatedBy = userId;
      await conversation.save({ session });

      await Message.create(
        [
          {
            conversationId,
            senderId: userId,
            isSystem: true,
            content: `Group has been renamed from ${conversation.name} to ${incomingName}.`,
          },
        ],
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
};

const removeGroupConversationLogo = async ({ conversationId, userId }) => {
  // 1. Fetch the conversation — caller must be an active participant
  const conversation = await Conversation.findOne({
    _id: conversationId,
    type: CONVERSATION_TYPES.GROUP,
    isDeleted: false,
  });

  const isParticipant = await ConversationParticipant.exists({
    conversationId,
    userId,
    hasLeft: false,
  });

  if (!conversation || !isParticipant) {
    throw new ErrorHandler(
      "Conversation not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // 2. Nothing to do if no logo is set
  if (!conversation.logo?.publicId) return;

  // 3. Capture publicId before clearing
  const oldPublicId = conversation.logo.publicId;

  // 4. Clear logo + create system message atomically — DB first
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      conversation.logo = { url: null, publicId: null };
      conversation.updatedBy = userId;
      await conversation.save({ session });

      await Message.create(
        [
          {
            conversationId,
            senderId: userId,
            isSystem: true,
            content: "Group logo has been removed.",
          },
        ],
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  // 5. Delete from Cloudinary after DB transaction succeeds
  //    Non-fatal — log and move on if it fails
  try {
    await deleteCloudinaryFile(oldPublicId, CLOUDINARY_RESOURCE_TYPES.IMAGE);
  } catch (err) {
    console.warn(
      `Failed to delete conversation logo from Cloudinary. PublicId: ${oldPublicId}`,
      err,
    );
  }
};

const addParticipant = async ({ conversationId, userId, targetUserId }) => {
  // 1. Cannot add yourself
  if (userId.equals(targetUserId)) {
    throw new ErrorHandler(
      "You cannot add yourself to the conversation.",
      EXCEPTION_CODES.INVALID_INPUT,
    );
  }

  // 2. Verify conversation exists and caller is an active participant
  const conversation = await Conversation.findOne({
    _id: conversationId,
    isDeleted: false,
  }).lean();

  const isParticipant = await ConversationParticipant.exists({
    conversationId,
    userId,
    hasLeft: false,
  });

  if (!conversation || !isParticipant) {
    throw new ErrorHandler(
      "Conversation not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  if (conversation.type !== CONVERSATION_TYPES.GROUP) {
    throw new ErrorHandler(
      "This operation is only allowed for Group conversations.",
      EXCEPTION_CODES.INVALID_INPUT,
    );
  }

  // 3. Enforce max participant cap
  const currentCount = await ConversationParticipant.countDocuments({
    conversationId,
    hasLeft: false,
  });

  if (currentCount >= MAX_GROUP_PARTICIPANTS) {
    throw new ErrorHandler(
      `Group has reached the maximum limit of ${MAX_GROUP_PARTICIPANTS} participants.`,
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  // 4. Check if target already has a participant record (active or previously left)
  const existingParticipant = await ConversationParticipant.findOne({
    conversationId,
    userId: targetUserId,
  });

  // 5. Fetch target user's name for the system message
  const targetUser = await User.findOne({
    _id: targetUserId,
    isDeleted: { $ne: true },
  })
    .select("_id name")
    .lean();

  if (!targetUser) {
    throw new ErrorHandler(
      "User not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (existingParticipant) {
        // 6a. User previously left — reactivate their record
        if (!existingParticipant.hasLeft) {
          throw new ErrorHandler(
            "User is already a participant of this conversation.",
            EXCEPTION_CODES.DUPLICATE_RESOURCE,
          );
        }

        existingParticipant.hasLeft = false;
        existingParticipant.leftAt = null;
        existingParticipant.rejoinedBy = userId;
        existingParticipant.rejoinedAt = new Date();
        existingParticipant.role = GROUP_ROLES.GroupMember;
        await existingParticipant.save({ session });

        // Reset ReadState cursor to current high-water mark so messages
        // sent while they were away don't appear as unread
        const latestMessage = await Message.findOne({
          conversationId,
          deletedAt: null,
        })
          .sort({ _id: -1 })
          .select("_id createdAt")
          .lean();

        await ReadState.findOneAndUpdate(
          { userId: targetUserId, conversationId },
          {
            $set: {
              lastReadMessageId: latestMessage?._id ?? null,
              lastReadAt: latestMessage?.createdAt ?? new Date(),
              unreadCount: 0,
              mentionCount: 0,
            },
          },
          { upsert: true, session },
        );
      } else {
        // 6b. First time joining — create participant record, seed ReadState,
        //     and notify the added user
        await ConversationParticipant.create(
          [
            {
              conversationId,
              userId: targetUserId,
              addedBy: userId,
              role: GROUP_ROLES.GroupMember,
              joinedAt: new Date(),
            },
          ],
          { session },
        );

        const latestMessage = await Message.findOne({
          conversationId,
          deletedAt: null,
        })
          .sort({ _id: -1 })
          .select("_id createdAt")
          .lean();

        await ReadState.create(
          [
            {
              userId: targetUserId,
              conversationId,
              lastReadMessageId: latestMessage?._id ?? null,
              lastReadAt: latestMessage?.createdAt ?? new Date(),
              unreadCount: 0,
              mentionCount: 0,
            },
          ],
          { session },
        );

        await Notification.create(
          [
            {
              recipientId: targetUserId,
              actorId: userId,
              type: NOTIFICATION_TYPES.ADDED_TO_GROUP,
              conversationId,
              isRead: false,
            },
          ],
          { session },
        );
      }

      // 7. System message — same for both rejoin and new add
      const action = existingParticipant ? "rejoined" : "was added to";

      await Message.create(
        [
          {
            conversationId,
            senderId: userId,
            isSystem: true,
            content: `${targetUser.name} ${action} the Group.`,
          },
        ],
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
};

const updateParticipantRole = async ({
  conversationId,
  participantId,
  userId,
  role,
}) => {
  // 1. Fetch the target participant
  const participant = await ConversationParticipant.findOne({
    _id: participantId,
    conversationId,
  });

  if (!participant || participant.hasLeft) {
    throw new ErrorHandler(
      "Participant not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // 2. Cannot change your own role
  if (participant.userId.equals(userId)) {
    throw new ErrorHandler(
      "You cannot change your own role.",
      EXCEPTION_CODES.INVALID_INPUT,
    );
  }

  // 3. No-op if role is already the same
  if (participant.role === role) return;

  // 4. Update the role
  participant.role = role;
  await participant.save();
};

const leaveConversation = async ({ conversationId, userId }) => {
  // 1. Fetch caller's active participant record
  const participant = await ConversationParticipant.findOne({
    conversationId,
    userId,
    hasLeft: false,
  });

  if (!participant) {
    throw new ErrorHandler(
      "Participant not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // 2. Last GroupAdmin must promote someone else before leaving
  if (participant.role === GROUP_ROLES.GroupAdmin) {
    const anotherAdminExists = await ConversationParticipant.exists({
      conversationId,
      userId: { $ne: userId },
      hasLeft: false,
      role: GROUP_ROLES.GroupAdmin,
    });

    if (!anotherAdminExists) {
      throw new ErrorHandler(
        "You are the only Group Admin. Promote another participant before leaving.",
        EXCEPTION_CODES.RESOURCE_CONFLICT,
      );
    }
  }

  // 3. Group must stay above minimum participant count after leaving
  const currentCount = await ConversationParticipant.countDocuments({
    conversationId,
    hasLeft: false,
  });

  if (currentCount <= MIN_GROUP_PARTICIPANTS) {
    throw new ErrorHandler(
      `Group must have at least ${MIN_GROUP_PARTICIPANTS} participants.`,
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  // 4. Fetch caller's name for system message
  const user = await User.findOne({ _id: userId }).select("name").lean();

  // 5. Mark as left + system message atomically
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      participant.hasLeft = true;
      participant.leftAt = new Date();
      await participant.save({ session });

      await Message.create(
        [
          {
            conversationId,
            senderId: userId,
            isSystem: true,
            content: `${user?.name ?? "A participant"} left the Group.`,
          },
        ],
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
};

const removeParticipant = async ({ conversationId, participantId, userId }) => {
  // 1. Fetch the target participant
  const participant = await ConversationParticipant.findOne({
    _id: participantId,
    conversationId,
  });
  if (!participant || participant.hasLeft) {
    throw new ErrorHandler(
      "Participant not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // 2. Can't remove yourself via this endpoint
  if (participant.userId.equals(userId)) {
    throw new ErrorHandler(
      "Use the leave endpoint to remove yourself.",
      EXCEPTION_CODES.INVALID_INPUT,
    );
  }

  // 3. Enforce min participant cap — group must stay at MIN_GROUP_PARTICIPANTS or above
  const currentCount = await ConversationParticipant.countDocuments({
    conversationId,
    hasLeft: false,
  });
  if (currentCount <= MIN_GROUP_PARTICIPANTS) {
    throw new ErrorHandler(
      `Group must have at least ${MIN_GROUP_PARTICIPANTS} participants.`,
      EXCEPTION_CODES.INVALID_INPUT,
    );
  }

  // 4. Fetch removed user's display name for the system message
  const removedUser = await User.findById(participant.userId)
    .select("name")
    .lean();

  // 5. Mark participant as removed + system message atomically
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      participant.hasLeft = true;
      participant.leftAt = new Date();
      await participant.save({ session });

      await Message.create(
        [
          {
            conversationId,
            senderId: userId,
            isSystem: true,
            content: `${removedUser?.name ?? "Someone"} removed from the Group.`,
          },
        ],
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
};

//#endregion

export const conversationService = {
  getConversations,
  lookupDirectConversation,
  getConversation,
  getParticipants,
  createDirectConversation,
  createGroupConversation,
  updateGroupConversationLogo,
  updateGroupConversation,
  removeGroupConversationLogo,
  addParticipant,
  updateParticipantRole,
  leaveConversation,
  removeParticipant,
};
