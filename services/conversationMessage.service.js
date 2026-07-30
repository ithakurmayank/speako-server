import { CHANNEL_TYPES } from "#constants/channel.constants.js";
import { OUTBOX_MESSAGE_TYPES } from "#constants/common.constants.js";
import { CONVERSATION_TYPES } from "#constants/conversation.constants.js";
import { EXCEPTION_CODES } from "#constants/exceptionCodes.constants.js";
import { FILE_STATUSES, FILE_TYPES } from "#constants/fileTypes.constants.js";
import { ORG_ROLES } from "#constants/roles.constants.js";
import { MEMBER_SCOPES } from "#constants/user.constants.js";
import { Channel } from "#models/channel.model.js";
import { Conversation } from "#models/conversation.model.js";
import { ConversationParticipant } from "#models/conversationParticipant.model.js";
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
import { Notification } from "#models/notification.model.js";
import { NOTIFICATION_TYPES } from "#constants/notifications.constants.js";
import { ReadState } from "#models/readState.model.js";
import { GROUP_MESSAGE_STATUS } from "#constants/message.constants.js";
import { deriveMessageType } from "#utils/message.util.js";

//#region GET services
const getConversationMessages = async ({ conversationId, userId, query }) => {
  const { pageSize, beforeId } = getCursorPaginationValues(query);
  const threadRootMessageId = query.threadRootMessageId ?? null;

  // Step 1: Verify the conversation exists and the caller has access
  // Direct: caller must be one of the two participants.
  // Group: caller must be an active (not left) participant.
  const conversation = await Conversation.findOne({
    _id: conversationId,
    isDeleted: false,
    $or: [
      {
        type: CONVERSATION_TYPES.DIRECT,
        $or: [
          { directParticipantAId: userId },
          { directParticipantBId: userId },
        ],
      },
      {
        type: CONVERSATION_TYPES.GROUP,
      },
    ],
  }).lean();

  const isParticipant =
    conversation?.type === CONVERSATION_TYPES.DIRECT
      ? true
      : await ConversationParticipant.exists({
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

  // Step 2: Build the message query
  // Thread mode: return replies under threadRootMessageId.
  // Feed mode: return root messages only (threadId: null).
  // Cursor: if beforeId is provided, return messages older than that _id.
  const filter = {
    conversationId,
    deletedAt: null,
    threadId: threadRootMessageId ?? null,
    ...(beforeId && { _id: { $lt: beforeId } }),
  };

  // Step 3: Fetch pageSize + 1 to determine if there are more pages
  const messages = await Message.find(filter)
    .sort({ _id: -1 })
    .limit(pageSize + 1)
    .lean();

  const hasMore = messages.length > pageSize;
  if (hasMore) messages.pop();

  if (messages.length === 0) {
    return getCursorPaginatedResponse({
      data: [],
      hasMore: false,
      nextCursor: null,
    });
  }

  // Step 4: Batch fetch sender details for this page of messages
  // One User.find for all unique senderIds — avoids N+1 queries.
  const senderIds = [...new Set(messages.map((m) => m.senderId.toString()))];
  const senders = await User.find({ _id: { $in: senderIds } })
    .select("_id name icon")
    .lean();
  const sendersMap = new Map(senders.map((s) => [s._id.toString(), s]));

  // Step 5: Stamp reactions — batch fetch all reactions for this page,
  // group by messageId + emoji, flag reactedByMe for the caller.
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

  // Step 6: Shape each message into the MessageDto
  // Merge sender details and reaction summaries per message.
  const data = messages.map((message) => {
    const sender = sendersMap.get(message.senderId.toString());
    const reactions = reactionsMap.get(message._id.toString()) ?? [];
    return toMessageDTO({ message, sender, reactions });
  });

  // Step 7: Build cursor for the next page
  // nextCursor is the _id of the oldest message on this page —
  // pass it as beforeId on the next request to load older messages.
  const nextCursor = hasMore ? messages[messages.length - 1]._id : null;

  return getCursorPaginatedResponse({ data, hasMore, nextCursor });
};
//#endregion

//#region UPDATE services
const GROUP_RECEIPT_THRESHOLD = 20;

const sendConversationMessage = async ({
  conversationId,
  userId,
  clientMessageId,
  content,
  fileIds,
  mentionedUserIds,
  threadRootMessageId,
}) => {
  // Step 1: Verify the conversation exists and the caller has access
  // Direct: caller must be one of the two fixed participants.
  // Group: caller must be an active (not left) participant.
  const conversation = await Conversation.findOne({
    _id: conversationId,
    isDeleted: false,
    $or: [
      {
        type: CONVERSATION_TYPES.DIRECT,
        $or: [
          { directParticipantAId: userId },
          { directParticipantBId: userId },
        ],
      },
      { type: CONVERSATION_TYPES.GROUP },
    ],
  }).lean();

  const isParticipant =
    conversation?.type === CONVERSATION_TYPES.DIRECT
      ? true
      : conversation
        ? await ConversationParticipant.exists({
            conversationId,
            userId,
            hasLeft: false,
          })
        : false;

  if (!conversation || !isParticipant) {
    throw new ErrorHandler(
      "Conversation not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // Step 2: Idempotency check
  // If this clientMessageId was already processed, return the existing message
  // instead of creating a duplicate. Handles network retries gracefully.
  const existingMessage = await Message.findOne({
    senderId: userId,
    conversationId,
    clientMessageId,
  }).lean();

  if (existingMessage) {
    return await getMessageById(existingMessage._id, userId);
  }

  // Step 3: Thread root validation
  // If replying in a thread, validate the root message exists in this
  // conversation and is itself a root (no nested threads — max depth is 1).
  if (threadRootMessageId) {
    const threadRoot = await Message.findOne({
      _id: threadRootMessageId,
      conversationId,
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

  // Step 4: Attachment validation
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

  // Step 5: Derive message type guard
  // Text takes priority. If no text, there must be at least one attachment.
  const messageType = deriveMessageType(content, attachedFiles);

  // Step 6: Resolve other participants for ReadState fan-out + receipt seeding
  // Direct: the other participant is whichever of the two fixed IDs isn't the sender.
  // Group: all active participants except the sender.
  // We verify they still exist as users — warn and continue if any are missing
  // (e.g. soft-deleted accounts), since messaging shouldn't be blocked by this.
  let otherParticipantIds;
  if (conversation.type === CONVERSATION_TYPES.DIRECT) {
    const otherId = conversation.directParticipantAId.equals(userId)
      ? conversation.directParticipantBId
      : conversation.directParticipantAId;
    otherParticipantIds = [otherId];
  } else {
    const groupParticipants = await ConversationParticipant.find({
      conversationId,
      userId: { $ne: userId },
      hasLeft: false,
    })
      .select("userId")
      .lean();
    otherParticipantIds = groupParticipants.map((p) => p.userId);
  }

  const activeOtherUsers = await User.find({
    _id: { $in: otherParticipantIds },
    isDeleted: false,
  })
    .select("_id")
    .lean();

  const activeOtherUserIds = activeOtherUsers.map((u) => u._id);

  if (activeOtherUserIds.length !== otherParticipantIds.length) {
    const foundIds = new Set(activeOtherUserIds.map((id) => id.toString()));
    const missingIds = otherParticipantIds
      .filter((id) => !foundIds.has(id.toString()))
      .map((id) => id.toString());
    console.warn(
      `One or more conversation participants could not be found. Missing: ${missingIds.join(", ")}`,
    );
  }

  // Step 7: Resolve thread root sender
  // Needed to create a ThreadReply notification for the root message's sender
  // without an extra DB query inside the transaction.
  let threadRootSenderId = null;
  if (threadRootMessageId) {
    const threadRoot = await Message.findOne({ _id: threadRootMessageId })
      .select("senderId")
      .lean();
    threadRootSenderId = threadRoot?.senderId ?? null;
  }

  // Step 8: Build content preview
  // Used for notification previews — text truncated to 500 chars,
  // or a descriptive fallback based on the first attachment's type.
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
  const mentionedSet = new Set(mentionedUserIds.map((id) => id.toString()));
  const now = new Date();

  // Step 9: Persist everything atomically
  // All writes happen in a single transaction:
  //   a) Message row
  //   b) File attachments scoped to this conversation
  //   c) Thread root reply counter incremented
  //   d) Conversation lastMessageAt updated
  //   e) Group message receipts seeded (groups ≤ GROUP_RECEIPT_THRESHOLD only)
  //   f) ReadState unread/mention counts incremented for all other participants
  //   g) Mention + ThreadReply notifications created inline
  let savedMessage;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // 9a — Create the message
      const [message] = await Message.create(
        [
          {
            conversationId,
            senderId: userId,
            clientMessageId,
            threadId: threadRootMessageId ?? null,
            content: content?.trim() ?? "",
            attachments: fileIds,
            mentions: mentionedUserIds,
            messageType,
          },
        ],
        { session },
      );

      savedMessage = message;

      // 9b — Mark files as attached and scope them to this conversation
      if (fileIds.length > 0) {
        await File.updateMany(
          { _id: { $in: fileIds } },
          {
            $set: {
              conversationId,
              channelId: null,
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
          { $inc: { replyCount: 1 }, $set: { lastReplyAt: now } },
          { session },
        );
      }

      // 9d — Stamp lastMessageAt on the conversation for sidebar ordering
      await Conversation.updateOne(
        { _id: conversationId },
        { $set: { lastMessageAt: now } },
        { session },
      );

      // 9e — Seed delivery receipts for small group conversations
      // Only group conversations with ≤ GROUP_RECEIPT_THRESHOLD total participants
      // get per-member receipt rows. Large groups and direct conversations skip this.
      // Receipts are embedded on the message as [{ userId, status, timestamp }].
      if (
        conversation.type === CONVERSATION_TYPES.GROUP &&
        activeOtherUserIds.length + 1 <= GROUP_RECEIPT_THRESHOLD
      ) {
        const receipts = activeOtherUserIds.map((participantId) => ({
          userId: participantId,
          status: GROUP_MESSAGE_STATUS.DELIVERED,
          timestamp: now,
        }));

        await Message.updateOne(
          { _id: message._id },
          { $push: { receipts: { $each: receipts } } },
          { session },
        );
      }

      // 9f — Increment ReadState unread counts for all other active participants
      // Participants who are mentioned get both unreadCount and mentionCount bumped.
      // ReadState rows are guaranteed to exist — provisioned at membership creation.
      await Promise.all(
        activeOtherUserIds.map((participantId) => {
          const isMentioned = mentionedSet.has(participantId.toString());
          return ReadState.updateOne(
            { userId: participantId, conversationId },
            isMentioned
              ? { $inc: { unreadCount: 1, mentionCount: 1 } }
              : { $inc: { unreadCount: 1 } },
            { session },
          );
        }),
      );

      // 9g — Create inline notifications for mentions and thread replies
      // Mention: one notification per mentioned user who is an active participant
      // (excluding the sender mentioning themselves).
      // ThreadReply: notify the root message's sender if they're a different
      // user and still an active participant in this conversation.
      const activeOtherUserIdSet = new Set(
        activeOtherUserIds.map((id) => id.toString()),
      );

      const notifications = [];

      for (const mentionedUserId of mentionedSet) {
        if (
          mentionedUserId !== userId.toString() &&
          activeOtherUserIdSet.has(mentionedUserId)
        ) {
          notifications.push({
            recipientId: mentionedUserId,
            actorId: userId,
            type: NOTIFICATION_TYPES.MENTION,
            messageId: message._id,
            conversationId,
            preview: contentPreview,
            isRead: false,
          });
        }
      }

      if (
        threadRootSenderId &&
        !threadRootSenderId.equals(userId) &&
        activeOtherUserIdSet.has(threadRootSenderId.toString())
      ) {
        notifications.push({
          recipientId: threadRootSenderId,
          actorId: userId,
          type: NOTIFICATION_TYPES.THREAD_REPLY,
          messageId: message._id,
          conversationId,
          preview: contentPreview,
          isRead: false,
        });
      }

      if (notifications.length > 0) {
        await Notification.create(notifications, { session });
      }
    });
  } catch (err) {
    // Duplicate clientMessageId race condition —
    // If two concurrent requests send the same message, the unique index
    // on (senderId, conversationId, clientMessageId) fires. Return the
    // already-saved message instead of throwing.
    if (err.code === 11000) {
      const duplicate = await Message.findOne({
        senderId: userId,
        conversationId,
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

const forceDeleteConversationMessage = async ({
  conversationId,
  messageId,
  userId,
}) => {
  // Step 1: Fetch the target message
  // Must exist in this specific conversation and not already be soft-deleted.
  const message = await Message.findOne({
    _id: messageId,
    conversationId,
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

const deleteOwnConversationMessage = async ({
  conversationId,
  messageId,
  userId,
}) => {
  // Step 1: Fetch the target message
  // Must exist in this specific conversation and not already be soft-deleted.
  const message = await Message.findOne({
    _id: messageId,
    conversationId,
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

const pinConversationMessage = async ({
  conversationId,
  messageId,
  userId,
}) => {
  // Step 1: Fetch the target message
  // Must exist in this conversation and not be soft-deleted.
  // Also fetch first attachment upfront to build the content snapshot
  // without a second message fetch later.
  const message = await Message.findOne({
    _id: messageId,
    conversationId,
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

  // Step 2: Idempotency — return existing pin if already pinned
  // Handles concurrent or duplicate pin requests gracefully.
  const existingPin = await PinnedMessage.findOne({
    messageId,
    conversationId,
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
  // The unique index on { messageId, conversationId } prevents double-pinning.
  // If two requests race, the loser catches the duplicate key error and
  // returns the winner's pin instead of throwing.
  try {
    const pin = await PinnedMessage.create({
      messageId,
      conversationId,
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
        conversationId,
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

const toggleConversationMessageReaction = async ({
  conversationId,
  messageId,
  userId,
  emoji,
}) => {
  // Step 1: Verify the message exists in this conversation and is not deleted
  const messageExists = await Message.exists({
    _id: messageId,
    conversationId,
    deletedAt: null,
  });

  if (!messageExists) {
    throw new ErrorHandler(
      "Message not found.",
      EXCEPTION_CODES.RESOURCE_NOT_FOUND,
    );
  }

  // Step 2: Check if the user has already reacted with this emoji
  // Reactions are embedded on the message as [{ emoji, users: [ObjectId] }].
  // We look for a subdocument matching this emoji where the users array
  // contains the calling user's id.
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

  // Fetch the top 5 most-recent reactors' names for the preview.
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

const editConversationMessage = async ({
  conversationId,
  messageId,
  userId,
  content,
  fileIds,
  mentionedUserIds,
}) => {
  // Step 1: Fetch the target message
  // Must exist in this conversation and not be soft-deleted.
  // Also fetch current attachments and mentions to compute the diff.
  const message = await Message.findOne({
    _id: messageId,
    conversationId,
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

  // Step 2: Ownership check — only the original sender may edit
  // Privacy-preserving 404 so callers can't probe other senders' messages.
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

  const messageType = deriveMessageType(content, finalFileTypes);

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
  //   b) Mark new files as attached + scope them to this conversation
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

      // 8b — Mark new files as attached and scope them to this conversation
      if (fileIdsToAdd.length > 0) {
        await File.updateMany(
          { _id: { $in: fileIdsToAdd } },
          {
            $set: {
              status: FILE_STATUSES.ATTACHED,
              expiresAt: null,
              conversationId,
              channelId: null,
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
            messageType,
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
//#endregion

export const conversationMessageService = {
  getConversationMessages,
  sendConversationMessage,
  forceDeleteConversationMessage,
  deleteOwnConversationMessage,
  pinConversationMessage,
  toggleConversationMessageReaction,
  editConversationMessage,
};
