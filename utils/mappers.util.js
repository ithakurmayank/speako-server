const toMessageDTO = ({ message, sender = null, reactions = [] }) => {
  return {
    id: message._id,
    channelId: message.channelId,
    conversationId: message.conversationId ?? null,

    senderId: message.senderId,
    senderName: sender?.name ?? null,
    senderIcon: sender?.icon ?? null,

    threadId: message.threadId ?? null,

    content: message.content ?? null,

    messageType: message.messageType,
    isEdited: message.isEdited,
    editedAt: message.editedAt ?? null,

    replyCount: message.replyCount,
    lastReplyAt: message.lastReplyAt ?? null,

    dmDeliveredAt: message.dmDeliveredAt ?? null,
    dmSeenAt: message.dmSeenAt ?? null,

    attachments: message.attachments ?? [],
    mentions: message.mentions ?? [],
    reactions,

    isDeleted: !!message.deletedAt,

    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
};

const enrichMessage = ({ message, sendersMap, reactionsMap }) => {
  return toMessageDTO({
    message,
    sender: sendersMap.get(message.senderId.toString()),
    reactions: reactionsMap.get(message._id.toString()) ?? [],
  });
};

export { toMessageDTO, enrichMessage };
