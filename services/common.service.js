import { Message } from "#models/message.model.js";
import { User } from "#models/user.model.js";
import { toMessageDTO } from "#utils/mappers.util.js";

//Fetch a single message and shape it as MessageDto
const getMessageById = async (messageId, userId) => {
  const message = await Message.findById(messageId)
    .populate(
      "attachments",
      "url originalName mimeType fileType sizeInBytes width height duration thumbnailUrl",
    )
    .populate("mentions", "_id name username")
    .lean();

  const sender = await User.findById(message.senderId)
    .select("_id name icon")
    .lean();

  // Stamp reactions with ReactedByMe for the calling user
  const reactions = (message.reactions ?? []).map((reaction) => ({
    emoji: reaction.emoji,
    count: reaction.users.length,
    reactedByMe: reaction.users.some((u) => u.equals(userId)),
    previewNames: [], // names need a User lookup — omitted for single message fetch
  }));

  return toMessageDTO({ message, sender, reactions });
};

export { getMessageById };
