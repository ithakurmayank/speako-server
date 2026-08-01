import { CHANNEL_TYPES } from "#constants/channel.constants.js";
import { OUTBOX_MESSAGE_TYPES } from "#constants/common.constants.js";
import { EXCEPTION_CODES } from "#constants/exceptionCodes.constants.js";
import { FILE_STATUSES, FILE_TYPES } from "#constants/fileTypes.constants.js";
import { ORG_ROLES } from "#constants/roles.constants.js";
import { MEMBER_SCOPES } from "#constants/user.constants.js";
import { Channel } from "#models/channel.model.js";
import { File } from "#models/file.model.js";
import { Membership } from "#models/membership.model.js";
import { Message } from "#models/message.model.js";
import { OutboxMessage } from "#models/outboxMessage.model.js";
import { PinnedMessage } from "#models/pinnedMessage.model.js";
import { Team } from "#models/team.model.js";
import { User } from "#models/user.model.js";
import { ErrorHandler } from "#utils/errorHandler.util.js";
import { toMessageDTO } from "#utils/mappers.util.js";
import {
  getCursorPaginatedResponse,
  getCursorPaginationValues,
} from "#utils/pagination.util.js";
import mongoose from "mongoose";
import { getMessageById } from "./common.service.js";
import { MESSAGE_TYPES } from "#constants/message.constants.js";
import { deriveMessageType } from "#utils/message.util.js";

//#region GET services
const getChannelMessages = async ({
  orgId,
  teamId,
  channelId,
  userId,
  query,
}) => {
  const { pageSize, beforeId } = getCursorPaginationValues(query);
  const threadRootMessageId = query.threadRootMessageId ?? null;

  // 1. Resolve caller's org + team roles in parallel
  const [callerOrgMembership, callerTeamMembership] = await Promise.all([
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

  if (!callerOrgMembership) {
    throw new ErrorHandler(
      "Channel not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  const callerIsAdmin =
    callerOrgMembership.role === ORG_ROLES.OrgOwner ||
    callerOrgMembership.role === ORG_ROLES.OrgAdmin ||
    callerTeamMembership?.role === ORG_ROLES.TeamAdmin;

  // 2. Verify channel exists and caller has access
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

  // 3. Build message filter
  //    threadRootMessageId=null → root messages only
  //    threadRootMessageId=<id> → replies under that thread
  const filter = {
    channelId,
    threadId: threadRootMessageId ?? null,
  };

  // Cursor: only return messages older than the given message ID
  // ObjectId is chronologically ordered so _id < beforeId = older messages
  if (beforeId) {
    filter._id = { $lt: beforeId };
  }

  // 4. Fetch pageSize + 1 to determine if there are more pages
  const messages = await Message.find(filter)
    .sort({ _id: -1 })
    .limit(pageSize + 1)
    .populate(
      "attachments",
      "url originalName mimeType fileType sizeInBytes width height duration thumbnailUrl",
    )
    .populate("mentions", "_id name username")
    .lean();

  const hasMore = messages.length > pageSize;
  if (hasMore) messages.pop();

  if (messages.length === 0) {
    return { data: [], hasMore: false, nextCursor: null };
  }

  // 5. Fetch sender details for this page of messages
  const senderIds = [...new Set(messages.map((m) => m.senderId.toString()))];

  const senders = await User.find({ _id: { $in: senderIds } })
    .select("_id name icon")
    .lean();

  const sendersMap = new Map(senders.map((u) => [u._id.toString(), u]));

  // 6. Stamp reactions — batch fetch all reactions for this page,
  //    group by messageId + emoji, flag ReactedByMe for the caller
  const messageIds = messages.map((m) => m._id);

  const rawReactions = await Message.aggregate([
    { $match: { _id: { $in: messageIds } } },
    { $unwind: { path: "$reactions", preserveNullAndEmptyArrays: false } },
    { $unwind: "$reactions.users" },
    {
      $lookup: {
        from: "users",
        localField: "reactions.users",
        foreignField: "_id",
        as: "reactorUser",
      },
    },
    { $unwind: "$reactorUser" },
    {
      $group: {
        _id: { messageId: "$_id", emoji: "$reactions.emoji" },
        count: { $sum: 1 },
        reactedByMe: {
          $max: {
            $cond: [{ $eq: ["$reactions.users", userId] }, true, false],
          },
        },
        previewNames: { $push: "$reactorUser.name" },
      },
    },
    {
      $group: {
        _id: "$_id.messageId",
        reactions: {
          $push: {
            emoji: "$_id.emoji",
            count: "$count",
            reactedByMe: "$reactedByMe",
            previewNames: { $slice: ["$previewNames", 5] },
          },
        },
      },
    },
  ]);

  const reactionsMap = new Map(
    rawReactions.map((r) => [r._id.toString(), r.reactions]),
  );

  // 7. Shape the response
  const data = messages.map((message) =>
    toMessageDTO({
      message,
      sender: sendersMap.get(message.senderId.toString()),
      reactions: reactionsMap.get(message._id.toString()) ?? [],
    }),
  );

  // Step 7: Build cursor for the next page
  // nextCursor is the _id of the oldest message on this page —
  // pass it as beforeId on the next request to load older messages.
  const nextCursor = hasMore ? messages[messages.length - 1]._id : null;

  return getCursorPaginatedResponse({ data, hasMore, nextCursor });
};

//#endregion

//#region UPDATE services
const sendChannelMessage = async ({
  orgId,
  teamId,
  channelId,
  userId,
  clientMessageId,
  content,
  fileIds,
  mentionedUserIds,
  threadRootMessageId,
}) => {
  // Step 1: Channel + team archive guard
  // Fetch channel and its parent team's archive status upfront.
  // Also need channel type to enforce announcement-only posting rules.
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

  const team = await Team.findOne({
    _id: teamId,
    orgId,
    isDeleted: { $ne: true },
  }).lean();

  if (team?.isArchived) {
    throw new ErrorHandler(
      "Cannot send message to an archived team channel.",
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  if (channel.isArchived) {
    throw new ErrorHandler(
      "Cannot send message from an archived channel.",
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  // Step 2: Announcement channel guard
  // Only channel moderators, team admins, or org admins can post in
  // announcement channels. Regular members are blocked.
  if (channel.type === CHANNEL_TYPES.ANNOUNCEMENT) {
    const [isChannelModerator, isTeamAdmin, isOrgAdmin] = await Promise.all([
      Membership.exists({
        userId,
        channelId,
        teamId,
        orgId,
        scope: MEMBER_SCOPES.CHANNEL,
        role: ORG_ROLES.ChannelModerator,
      }),

      Membership.exists({
        userId,
        teamId,
        orgId,
        scope: MEMBER_SCOPES.TEAM,
        role: ORG_ROLES.TeamAdmin,
      }),

      Membership.exists({
        userId,
        orgId,
        scope: MEMBER_SCOPES.ORG,
        role: { $in: [ORG_ROLES.OrgOwner, ORG_ROLES.OrgAdmin] },
      }),
    ]);

    if (!isChannelModerator && !isTeamAdmin && !isOrgAdmin) {
      throw new ErrorHandler(
        "Only channel moderators can post in announcement channels.",
        EXCEPTION_CODES.FORBIDDEN,
      );
    }
  }

  // Step 3: Idempotency check
  // If this clientMessageId was already processed, return the existing message
  // instead of creating a duplicate. Handles network retries gracefully.
  const existingMessage = await Message.findOne({
    senderId: userId,
    channelId,
    clientMessageId,
  }).lean();

  if (existingMessage) {
    return await getMessageById(existingMessage._id, userId);
  }

  // Step 4: Thread root validation
  // If replying in a thread, validate the root message exists in this channel
  // and is itself a root message (no nested threads — max depth is 1).
  if (threadRootMessageId) {
    const threadRoot = await Message.findOne({
      _id: threadRootMessageId,
      channelId,
      deletedAt: null,
    }).lean();

    if (!threadRoot) {
      throw new ErrorHandler(
        "Thread root message not found or has been deleted.",
        EXCEPTION_CODES.RESOURCE_NOT_FOUND,
      );
    }

    if (threadRoot.threadId !== null) {
      throw new ErrorHandler(
        "Cannot reply to a thread reply. Maximum thread depth is 1.",
        EXCEPTION_CODES.INVALID_INPUT,
      );
    }
  }

  // Step 5: Attachment validation
  // Files must have been uploaded first and be in "pending" status,
  // uploaded by this sender, and not yet attached to another message.
  let attachedFiles = [];
  if (fileIds.length > 0) {
    attachedFiles = await File.find({
      _id: { $in: fileIds },
      uploadedByUserId: userId,
      status: FILE_STATUSES.PENDING,
      channelId: null,
      conversationId: null,
      isDeleted: false,
    }).lean();

    if (attachedFiles.length !== fileIds.length) {
      const foundIds = attachedFiles.map((f) => f._id.toString());
      const missingIds = fileIds.filter(
        (id) => !foundIds.includes(id.toString()),
      );
      throw new ErrorHandler(
        `One or more files could not be attached. Missing: ${missingIds.join(", ")}`,
        EXCEPTION_CODES.INVALID_INPUT,
      );
    }
  }

  // Step 6: Derive message type
  // Text takes priority. If no text, type is derived from file types.
  // A message must have text or at least one attachment.
  const messageType = deriveMessageType(content, attachedFiles);

  // Step 7: Resolve thread root sender
  // Needed for the outbox payload so the background worker can create
  // a ThreadReply notification without an extra DB query.
  let threadRootSenderId = null;
  if (threadRootMessageId) {
    const threadRoot = await Message.findOne({ _id: threadRootMessageId })
      .select("senderId")
      .lean();
    threadRootSenderId = threadRoot?.senderId ?? null;
  }

  // Step 8: Build content preview
  // Used by the outbox worker for notification previews.
  // Text is truncated to 500 chars; fallback to paperclip emoji + name.
  const buildContentPreview = (text, firstFile) => {
    if (text?.trim()) return text.trim().slice(0, 500);
    if (!firstFile) return "[Attachment]";

    const name = firstFile.originalName;
    const type = firstFile.fileType;

    if (type === FILE_TYPES.IMAGE) return `📷 ${name}`;
    if (type === FILE_TYPES.VIDEO) return `🎥 ${name}`;
    if (type === FILE_TYPES.AUDIO) return `🎵 ${name}`;
    if (type === FILE_TYPES.DOCUMENT) return `📄 ${name}`;
    return `📎 ${name}`;
  };

  const contentPreview = buildContentPreview(content, attachedFiles[0] ?? null);

  // Step 9: Persist everything atomically
  // All writes happen in a single transaction:
  //   a) Message row
  //   b) File attachments linked to the message
  //   c) Mentions stored on the message
  //   d) Thread root reply counter incremented
  //   e) Outbox row queued for background worker (ReadState fan-out +
  //      mention/thread-reply notifications)
  let savedMessage;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // 9a — Create the message
      const [message] = await Message.create(
        [
          {
            channelId,
            senderId: userId,
            threadId: threadRootMessageId ?? null,
            content: content?.trim() ?? "",
            attachments: fileIds,
            mentions: mentionedUserIds,
            clientMessageId,
            messageType,
          },
        ],
        { session },
      );

      savedMessage = message;

      // 9b — Link files to this message and mark them as attached
      if (fileIds.length > 0) {
        await File.updateMany(
          { _id: { $in: fileIds } },
          {
            $set: {
              channelId,
              conversationId: null,
              status: FILE_STATUSES.ATTACHED,
              expiresAt: null,
            },
          },
          { session },
        );
      }

      // 9c — Increment thread root reply counter + update lastReplyAt
      if (threadRootMessageId) {
        await Message.updateOne(
          { _id: threadRootMessageId },
          {
            $inc: { replyCount: 1 },
            $set: { lastReplyAt: new Date() },
          },
          { session },
        );
      }

      // 9d — Queue outbox row for background worker
      // Worker handles: ReadState unread count fan-out for all channel members,
      // mention notifications, and thread-reply notifications.
      await OutboxMessage.create(
        [
          {
            type: OUTBOX_MESSAGE_TYPES.CHANNEL_MESSAGE_SEND,
            payload: {
              messageId: message._id,
              channelId,
              senderId: userId,
              mentionedUserIds,
              threadRootMessageId: threadRootMessageId ?? null,
              threadRootSenderId,
              contentPreview,
            },
            isProcessed: false,
            createdBy: userId,
          },
        ],
        { session },
      );
    });
  } catch (err) {
    // Duplicate clientMessageId race condition -
    // If two concurrent requests send the same message, the unique index
    // on (senderId, clientMessageId) fires. Return the already-saved message
    // instead of throwing.
    if (err.code === 11000) {
      const duplicate = await Message.findOne({
        senderId: userId,
        channelId,
        clientMessageId,
      }).lean();

      if (duplicate) {
        return await getMessageById(duplicate._id, userId);
      }
    }
    throw err;
  } finally {
    await session.endSession();
  }

  // Step 10: Return the saved message shaped as MessageDto
  return await getMessageById(savedMessage._id, userId);
};

const forceDeleteChannelMessage = async ({ channelId, messageId, userId }) => {
  // Step 1: Fetch the target message
  // Must exist in this specific channel and not already be soft-deleted.
  const message = await Message.findOne({
    _id: messageId,
    channelId,
  });

  if (!message || message.deletedAt !== null) {
    throw new ErrorHandler(
      "Message not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // Step 2: Prevent self-deletion via this endpoint
  // Moderators use force-delete for other members' content only.
  // Own messages must go through the delete-own endpoint.
  if (message.senderId.equals(userId)) {
    throw new ErrorHandler(
      "Use the delete-own endpoint to delete your own messages.",
      EXCEPTION_CODES.INVALID_INPUT,
    );
  }

  // Step 3: Soft-delete the message
  message.deletedAt = new Date();
  message.deletedBy = userId;
  await message.save();
};

const deleteOwnMessage = async ({ channelId, messageId, userId }) => {
  // Step 1: Fetch the target message
  // Must exist in this specific channel and not already be soft-deleted.
  const message = await Message.findOne({
    _id: messageId,
    channelId,
  });

  if (!message || message.deletedAt !== null) {
    throw new ErrorHandler(
      "Message not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // Step 2: Ownership check — caller must be the sender
  // Privacy-preserving 404 if the message belongs to someone else,
  // so the caller can't probe whether a message exists by another user.
  if (!message.senderId.equals(userId)) {
    throw new ErrorHandler(
      "Message not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // Step 3: Soft-delete the message
  message.deletedAt = new Date();
  message.deletedBy = userId;
  await message.save();
};

const pinChannelMessage = async ({ channelId, messageId, userId }) => {
  // Step 1: Fetch the message + channel and team archive state
  // Need content and first attachment upfront to build the content snapshot
  // that gets stored on the pin — avoids a second message fetch later.
  const message = await Message.findOne({
    _id: messageId,
    channelId,
    deletedAt: null,
  })
    .select("content attachments")
    .lean();

  if (!message) {
    throw new ErrorHandler(
      "Message not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  const channel = await Channel.findOne({
    _id: channelId,
    isDeleted: false,
  })
    .select("isArchived teamId")
    .lean();

  if (!channel) {
    throw new ErrorHandler(
      "Channel not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  const team = await Team.findOne({
    _id: channel.teamId,
    isDeleted: { $ne: true },
  })
    .select("isArchived")
    .lean();

  if (team?.isArchived) {
    throw new ErrorHandler(
      "Cannot pin in an archived team channel.",
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  if (channel.isArchived) {
    throw new ErrorHandler(
      "Cannot pin in an archived channel.",
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  // Step 2: Idempotency — return existing pin if already pinned
  // Handles concurrent or duplicate pin requests gracefully.
  const existingPin = await PinnedMessage.findOne({
    messageId,
    channelId,
  }).lean();

  if (existingPin) {
    return {
      id: existingPin._id,
      messageId: existingPin.messageId,
      pinnedByUserId: existingPin.pinnedBy,
      pinnedAt: existingPin.pinnedAt,
    };
  }

  // Step 3: Build content snapshot for the pin
  // Stored on the pin row so it can be displayed in the pinned-messages
  // list without re-fetching the original message.
  let firstAttachment = null;
  if (message.attachments?.length > 0) {
    firstAttachment = await File.findById(message.attachments[0])
      .select("fileType originalName")
      .lean();
  }

  const buildContentSnapshot = (content, attachment) => {
    if (content?.trim()) return content.trim().slice(0, 500);
    if (!attachment) return "[Attachment]";

    const { originalName: name, fileType: type } = attachment;
    if (type === FILE_TYPES.IMAGE) return `📷 ${name}`;
    if (type === FILE_TYPES.VIDEO) return `🎥 ${name}`;
    if (type === FILE_TYPES.AUDIO) return `🎵 ${name}`;
    if (type === FILE_TYPES.DOCUMENT) return `📄 ${name}`;
    return `📎 ${name}`;
  };

  const contentSnapshot = buildContentSnapshot(
    message.content,
    firstAttachment,
  );

  // Step 4: Create the pin — handle concurrent duplicate via unique index
  // The unique index on { messageId, channelId } prevents double-pinning.
  // If two requests race, the loser catches the duplicate key error and
  // returns the winner's pin instead of throwing.
  try {
    const pin = await PinnedMessage.create({
      messageId,
      channelId,
      pinnedBy: userId,
      contentSnapshot,
      pinnedAt: new Date(),
    });

    return {
      id: pin._id,
      messageId: pin.messageId,
      pinnedByUserId: pin.pinnedBy,
      pinnedAt: pin.pinnedAt,
    };
  } catch (err) {
    if (err.code === 11000) {
      const concurrentPin = await PinnedMessage.findOne({
        messageId,
        channelId,
      }).lean();

      if (concurrentPin) {
        return {
          id: concurrentPin._id,
          messageId: concurrentPin.messageId,
          pinnedByUserId: concurrentPin.pinnedBy,
          pinnedAt: concurrentPin.pinnedAt,
        };
      }
    }
    throw err;
  }
};

const toggleChannelMessageReaction = async ({
  channelId,
  messageId,
  userId,
  emoji,
}) => {
  // Step 1: Verify the message exists in this channel and is not deleted
  const messageExists = await Message.exists({
    _id: messageId,
    channelId,
    deletedAt: null,
  });

  if (!messageExists) {
    throw new ErrorHandler(
      "Message not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // Step 2: Check if the user has already reacted with this emoji
  const existingReaction = await Message.exists({
    _id: messageId,
    reactions: {
      $elemMatch: {
        emoji,
        users: userId,
      },
    },
  });

  let added;

  if (existingReaction) {
    // Step 3a: Remove reaction — pull userId from the matching emoji's users array.
    // If no users remain for this emoji, also remove the emoji subdocument entirely
    // to keep the reactions array clean.
    await Message.updateOne(
      { _id: messageId },
      { $pull: { "reactions.$[elem].users": userId } },
      { arrayFilters: [{ "elem.emoji": emoji }] },
    );

    // Clean up the emoji subdocument if it now has zero reactors
    await Message.updateOne(
      { _id: messageId },
      { $pull: { reactions: { emoji, users: { $size: 0 } } } },
    );

    added = false;
  } else {
    // Step 3b: Add reaction — either push userId into an existing emoji subdocument
    // or create a new subdocument for this emoji if it doesn't exist yet.
    // $addToSet on users guards against any race that might sneak in a duplicate.
    const updated = await Message.updateOne(
      { _id: messageId, "reactions.emoji": emoji },
      { $addToSet: { "reactions.$.users": userId } },
    );

    if (updated.matchedCount === 0) {
      // No subdocument for this emoji yet — create one
      await Message.updateOne(
        { _id: messageId },
        { $push: { reactions: { emoji, users: [userId] } } },
      );
    }

    added = true;
  }

  // Step 4: Build the updated reaction summary for this emoji
  // Fetch the latest state of the emoji's users array so we can return
  // an accurate count, reactedByMe flag, and preview names to the client —
  // allowing the client to patch just this emoji's row in its local state.
  const message = await Message.findOne(
    { _id: messageId, "reactions.emoji": emoji },
    { "reactions.$": 1 },
  ).lean();

  const reactionEntry = message?.reactions?.[0];

  if (!reactionEntry || reactionEntry.users.length === 0) {
    return {
      emoji,
      added,
      updatedSummary: null,
    };
  }

  // Fetch the top 5 most-recent reactors' names for the preview
  // Since embedded users have no timestamp, we take the last 5 entries
  // (most recently pushed) and reverse for display order.
  const previewUserIds = [...reactionEntry.users].reverse().slice(0, 5);
  const previewUsers = await User.find({ _id: { $in: previewUserIds } })
    .select("name")
    .lean();

  const previewNames = previewUserIds
    .map((id) => previewUsers.find((u) => u._id.equals(id))?.name ?? null)
    .filter(Boolean);

  return {
    emoji,
    added,
    updatedSummary: {
      emoji,
      count: reactionEntry.users.length,
      reactedByMe: reactionEntry.users.some((id) => id.equals(userId)),
      previewNames,
    },
  };
};

const editChannelMessage = async ({
  channelId,
  messageId,
  userId,
  content,
  fileIds,
  mentionedUserIds,
}) => {
  // Step 1: Fetch the message + channel and team archive state
  // Need current attachments and mentions to compute the diff —
  // what to remove vs what to add vs what to keep.
  const message = await Message.findOne({
    _id: messageId,
    channelId,
    deletedAt: null,
  })
    .select("senderId attachments")
    .populate({
      path: "attachments",
      select: "fileType",
    })
    .lean();

  if (!message) {
    throw new ErrorHandler(
      "Message not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  const channel = await Channel.findOne({
    _id: channelId,
    isDeleted: false,
  })
    .select("isArchived teamId")
    .lean();

  if (!channel) {
    throw new ErrorHandler(
      "Channel not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  if (channel.isArchived) {
    throw new ErrorHandler(
      "Cannot edit a message in an archived channel.",
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  const team = await Team.findOne({
    _id: channel.teamId,
    isDeleted: { $ne: true },
  })
    .select("isArchived")
    .lean();

  if (team?.isArchived) {
    throw new ErrorHandler(
      "Cannot edit a message in an archived team channel.",
      EXCEPTION_CODES.RESOURCE_CONFLICT,
    );
  }

  // Step 2: Ownership check — only the original sender may edit
  if (!message.senderId.equals(userId)) {
    throw new ErrorHandler(
      "Message not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // Step 3: Compute attachment diff
  // The caller sends the complete desired set of fileIds (kept + new).
  // Files absent from the desired set are removed; files not currently
  // on the message are treated as new pending uploads to attach.
  const currentFileIds = new Set(
    message.attachments.map((id) => id.toString()),
  );
  const desiredFileIds = new Set(fileIds.map((id) => id.toString()));

  const fileIdsToRemove = message.attachments.filter(
    (id) => !desiredFileIds.has(id.toString()),
  );
  const fileIdsToAdd = fileIds.filter(
    (id) => !currentFileIds.has(id.toString()),
  );

  // Step 4: Validate new attachments
  // New files must be pending uploads by this sender not yet attached anywhere.
  let newFiles = [];
  if (fileIdsToAdd.length > 0) {
    newFiles = await File.find({
      _id: { $in: fileIdsToAdd },
      uploadedByUserId: userId,
      status: FILE_STATUSES.PENDING,
      channelId: null,
      conversationId: null,
      isDeleted: false,
    }).lean();

    if (newFiles.length !== fileIdsToAdd.length) {
      const foundIds = new Set(newFiles.map((f) => f._id.toString()));
      const missingIds = fileIdsToAdd.filter(
        (id) => !foundIds.has(id.toString()),
      );
      throw new ErrorHandler(
        `One or more files could not be attached. Missing: ${missingIds.join(", ")}`,
        EXCEPTION_CODES.INVALID_INPUT,
      );
    }
  }

  // Step 5: Derive message type guard
  // Text takes priority. If no text, there must be at least one attachment.
  const retainedFileTypes = message.attachments
    .filter((file) => desiredFileIds.has(file._id.toString()))
    .map((file) => file.type);

  const finalFileTypes = [
    ...retainedFileTypes,
    ...newFiles.map((file) => file.type),
  ];

  // Step 6: Validate mentioned users
  // All mentioned user IDs must exist and not be deleted.
  const uniqueMentionedUserIds = [
    ...new Set(mentionedUserIds.map((id) => id.toString())),
  ];
  if (uniqueMentionedUserIds.length > 0) {
    const activeUsers = await User.find({
      _id: { $in: uniqueMentionedUserIds },
      isDeleted: false,
    })
      .select("_id")
      .lean();

    if (activeUsers.length !== uniqueMentionedUserIds.length) {
      const foundIds = new Set(activeUsers.map((u) => u._id.toString()));
      const missingIds = uniqueMentionedUserIds.filter(
        (id) => !foundIds.has(id),
      );
      throw new ErrorHandler(
        `One or more mentioned users could not be found. Missing: ${missingIds.join(", ")}`,
        EXCEPTION_CODES.INVALID_INPUT,
      );
    }
  }

  // Step 7: Fetch files to be removed so we can soft-delete them
  // and queue their Cloudinary assets for cleanup inside the transaction.
  let filesToCleanup = [];
  if (fileIdsToRemove.length > 0) {
    filesToCleanup = await File.find({
      _id: { $in: fileIdsToRemove },
      isDeleted: false,
    })
      .select("publicId cloudinaryResourceType")
      .lean();
  }

  // Step 8: Persist all changes atomically
  // All writes happen in a single transaction:
  //   a) Soft-delete removed File docs
  //   b) Mark new files as attached + scope them to this channel
  //   c) $set message.attachments to the full desired ordered array
  //   d) $set message.mentions to the full desired set
  //   e) Mark message as edited
  //   f) Queue outbox rows for Cloudinary cleanup of removed files
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // 8a — Soft-delete files being removed from the message
      if (fileIdsToRemove.length > 0) {
        await File.updateMany(
          { _id: { $in: fileIdsToRemove } },
          {
            $set: { isDeleted: true, deletedAt: new Date(), deletedBy: userId },
          },
          { session },
        );
      }

      // 8b — Mark new files as attached and scope them to this channel
      if (fileIdsToAdd.length > 0) {
        await File.updateMany(
          { _id: { $in: fileIdsToAdd } },
          {
            $set: {
              status: FILE_STATUSES.ATTACHED,
              expiresAt: null,
              channelId,
              conversationId: null,
            },
          },
          { session },
        );
      }

      // 8c-8e — Update message: attachments (ordered), mentions, edit metadata
      // $set attachments to the full desired fileIds array — order is preserved
      // exactly as the caller specified, naturally handling add/remove/reorder.
      await Message.updateOne(
        { _id: messageId },
        {
          $set: {
            content: content?.trim() ?? "",
            attachments: fileIds,
            mentions: uniqueMentionedUserIds,
            isEdited: true,
            editedAt: new Date(),
          },
        },
        { session },
      );

      // 8f — Queue Cloudinary deletes for removed files inside the transaction
      // so they roll back together if anything fails — preventing orphaned
      // assets from being deleted when their File docs are still intact.
      if (filesToCleanup.length > 0) {
        const outboxRows = filesToCleanup.map((file) => ({
          type: OUTBOX_MESSAGE_TYPES.CLOUDINARY_DELETE,
          payload: {
            publicId: file.publicId,
            cloudinaryResourceType: file.cloudinaryResourceType,
          },
          isProcessed: false,
          createdBy: userId,
        }));

        await OutboxMessage.create(outboxRows, { session });
      }
    });
  } finally {
    await session.endSession();
  }

  // Step 9: Return the updated message shaped as MessageDto
  return await getMessageById(messageId, userId);
};

const uploadChannelAttachment = async ({
  orgId,
  teamId,
  channelId,
  userId,
  file,
}) => {
  // Step 1: Validate file presence
  // Multer handles mime type filtering and size limits via middleware.
  // We still guard against a missing file in case middleware is misconfigured.
  if (!file) {
    throw new ErrorHandler("No file provided.", EXCEPTION_CODES.INVALID_INPUT);
  }

  // Step 2: Upload to Cloudinary
  // Upload first — if the DB insert fails we delete the asset in the catch block.
  const uploadResult = await uploadAttachment(file.buffer, file.mimetype, {
    orgId,
    teamId,
    channelId,
    date: new Date(),
  });

  // Step 3: Persist the File doc as "pending"
  // Status is PENDING until the user actually sends the message.
  // expiresAt ensures orphaned uploads (user closed composer) are auto-cleaned.
  // No channelId/conversationId yet — those are set when the message is sent.
  const expiresAt = dayjs().add(FILE_TTL_EXPIRY_SECONDS, "second").toDate();

  let fileDoc;
  try {
    fileDoc = await File.create({
      uploadedByUserId: userId,
      url: uploadResult.url,
      publicId: uploadResult.publicId,
      cloudinaryResourceType: uploadResult.cloudinaryResourceType,
      fileType: uploadResult.fileType,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeInBytes: file.size,
      width: uploadResult.width ?? null,
      height: uploadResult.height ?? null,
      duration: uploadResult.duration ?? null,
      thumbnailUrl: uploadResult.thumbnailUrl ?? null,
      status: FILE_STATUSES.PENDING,
      expiresAt,
      channelId: null,
      conversationId: null,
      createdBy: userId,
    });
  } catch (err) {
    // Step 4: DB insert failed — delete the Cloudinary asset immediately
    // so we don't leak storage for an asset that has no File record.
    try {
      await deleteCloudinaryFile(
        uploadResult.publicId,
        uploadResult.cloudinaryResourceType,
      );
    } catch (cleanupErr) {
      console.warn(
        `Failed to delete Cloudinary asset after DB insert failure. PublicId: ${uploadResult.publicId}`,
        cleanupErr,
      );
    }
    throw err;
  }

  // Step 5: Return the pre-upload response
  // Client holds FileId and passes it in SendMessageDto.fileIds when sending.
  return {
    fileId: fileDoc._id,
    url: fileDoc.url,
    thumbnailUrl: fileDoc.thumbnailUrl ?? null,
    originalName: fileDoc.originalName,
    mimeType: fileDoc.mimeType,
    sizeInBytes: fileDoc.sizeInBytes,
    fileType: fileDoc.fileType,
    expiresAt: fileDoc.expiresAt,
  };
};

//#endregion

export const channelMessageService = {
  getChannelMessages,
  sendChannelMessage,
  forceDeleteChannelMessage,
  deleteOwnMessage,
  pinChannelMessage,
  toggleChannelMessageReaction,
  editChannelMessage,
  uploadChannelAttachment,
};
