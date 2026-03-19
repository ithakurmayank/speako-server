// const newGroupChat = TryCatch(async (req, res, next) => {
//   const { name, members } = req.body;

//   if (members.length < 2) {
//     return next(
//       new ErrorHandler(
//         "Atleast three members are required to create a group",
//         400,
//       ),
//     );
//   }

//   const groupMembers = [...members, req.userId];
//   await Chat.create({
//     name,
//     members: groupMembers,
//     creator: req.userId,
//     groupChat: true,
//   });

//   emitEvent(req, ALERT, groupMembers, `Welcome to ${name} group`);
//   emitEvent(req, REFETCH_CHATS, members);

//   return res.status(201).json({
//     success: true,
//     message: "Group created successfully",
//   });
// });

// const getMyChats = TryCatch(async (req, res, next) => {
//   const chats = await Chat.find({ members: req.userId }).populate(
//     "members",
//     "name avatar",
//   );

//   const transformedChats = chats.map(({ _id, name, members, groupChat }) => {
//     const otherMembers = getOtherMember(members, req.userId);

//     return {
//       _id,
//       avatar: groupChat
//         ? members.slice(0, 3).map(({ avatar }) => avatar.url)
//         : [otherMembers.avatar.url],
//       members: members.reduce((prev, curr) => {
//         if (curr._id.toString() !== req.userId.toString()) {
//           prev.push(curr._id);
//         }
//         return prev;
//       }, []),
//       groupChat,
//       name: groupChat ? name : otherMembers.name,
//     };
//   });

//   return res.status(201).json({
//     success: true,
//     chats: transformedChats,
//   });
// });

// const getMyGroups = TryCatch(async (req, res, next) => {
//   const chats = await Chat.find({
//     members: req.userId,
//     creator: req.userId,
//     groupChat: true,
//   }).populate("members", "name avatar");

//   const transformedChats = chats.map(({ members, _id, groupChat, name }) => ({
//     _id,
//     groupChat,
//     name,
//     avatar: members.slice(0, 3).map(({ avatar }) => avatar.url),
//   }));

//   return res.status(201).json({
//     success: true,
//     groups: transformedChats,
//   });
// });

// const addMembers = TryCatch(async (req, res, next) => {
//   const { chatId, members } = req.body;

//   if (!members || members.length < 1)
//     return next(new ErrorHandler("Members are required", 404));

//   const chat = await Chat.findById(chatId);

//   if (!chat) return next(new ErrorHandler("Chat not found", 404));
//   if (!chat.groupChat)
//     return next(new ErrorHandler("This is not a group chat. ", 400));
//   if (chat.creator.toString() !== req.userId.toString())
//     return next(new ErrorHandler("You are not allowed to add members.", 403));

//   const allNewMembersPromise = members.map((i) => User.findById(i, "name"));

//   const allNewMembers = await Promise.all(allNewMembersPromise);
//   const uniqueMembers = allNewMembers
//     .filter(({ _id }) => !chat.members.includes(_id.toString()))
//     .map(({ _id }) => _id);

//   chat.members.push(...uniqueMembers);

//   if (chat.members.length > 100)
//     return next(
//       new ErrorHandler("Group cannot have more than 100 members", 400),
//     );

//   await chat.save();

//   const allNewMembersName = allNewMembers.map(({ name }) => name);

//   emitEvent(
//     req,
//     ALERT,
//     chat.members,
//     `${allNewMembersName} have been added to the group`,
//   );

//   return res
//     .status(200)
//     .json({ success: true, message: "Members added successfully" });
// });

// const removeMember = TryCatch(async (req, res, next) => {
//   const { userId, chatId } = req.body;

//   const chat = await Chat.findById(chatId);

//   if (!chat) return next(new ErrorHandler("Chat not found", 404));
//   if (!chat.groupChat)
//     return next(new ErrorHandler("This is not a group chat. ", 400));
//   if (chat.creator.toString() !== req.userId.toString())
//     return next(
//       new ErrorHandler("You are not allowed to remove members.", 403),
//     );
//   if (chat.members.length <= 3)
//     return next(new ErrorHandler("Group must have at least 3 members", 400));

//   const userToRemove = await User.findById(userId, "name");

//   const allChatMembers = chat.members.map((i) => i.toString());

//   chat.members = chat.members.filter(
//     (member) => member.toString() !== userId.toString(),
//   );

//   await chat.save();

//   emitEvent(req, ALERT, chat.members, {
//     message: `${userToRemove.name} has been removed from the group`,
//     chatId,
//   });

//   emitEvent(req, REFETCH_CHATS, allChatMembers);

//   return res.status(200).json({
//     success: true,
//     message: "Member removed successfully",
//   });
// });

// const leaveGroup = TryCatch(async (req, res, next) => {
//   const chatId = req.params.id;

//   const chat = await Chat.findById(chatId);

//   if (!chat) return next(new ErrorHandler("Chat not found", 404));

//   if (!chat.groupChat)
//     return next(new ErrorHandler("This is not a group chat", 400));

//   const remainingMembers = chat.members.filter(
//     (member) => member.toString() !== req.userId.toString(),
//   );

//   if (remainingMembers.length < 3)
//     return next(new ErrorHandler("Group must have at least 3 members", 400));

//   if (chat.creator.toString() === req.userId.toString()) {
//     chat.creator = remainingMembers[0];
//   }

//   chat.members = remainingMembers;

//   const [user] = await Promise.all([
//     User.findById(req.userId, "name"),
//     chat.save(),
//   ]);

//   emitEvent(req, ALERT, chat.members, {
//     chatId,
//     message: `User ${user.name} has left the group`,
//   });

//   return res.status(200).json({
//     success: true,
//     message: "Left Group Successfully",
//   });
// });

// const sendAttachments = TryCatch(async (req, res, next) => {
//   const { chatId } = req.body;

//   const files = req.files || [];

//   if (files.length < 1)
//     return next(new ErrorHandler("Atleast one file is required", 400));
//   if (files.length > 5)
//     return next(new ErrorHandler("Maximum five files can be attached", 400));

//   const [chat, user] = await Promise.all([
//     Chat.findById(chatId),
//     User.findById(req.userId, "name"),
//   ]);

//   //   Upload files here
//   // const attachments = await uploadFilesToCloudinary(files);
//   const attachments = [];

//   const messageForDB = {
//     content: "",
//     attachments,
//     sender: user._id,
//     chat: chatId,
//   };

//   const messageForRealTime = {
//     ...messageForDB,
//     sender: {
//       _id: user._id,
//       name: user.name,
//     },
//   };

//   const message = await Message.create(messageForDB);

//   emitEvent(req, NEW_MESSAGE, chat.members, {
//     message: messageForRealTime,
//     chatId,
//   });

//   emitEvent(req, NEW_MESSAGE_ALERT, chat.members, { chatId });

//   return res.status(200).json({
//     success: true,
//     message,
//   });
// });

// const getChatDetails = TryCatch(async (req, res, next) => {
//   if (req.query.populate === "true") {
//     const chat = await Chat.findById(req.params.id)
//       .populate("members", "name avatar")
//       .lean();
//     if (!chat) return next(new ErrorHandler("Chat not found", 404));

//     chat.members = chat.members.map(({ _id, name, avatar }) => ({
//       _id,
//       name,
//       avatar: avatar.url,
//     }));

//     return res.status(200).json({
//       success: true,
//       chat,
//     });
//   } else {
//     const chat = await Chat.findById(req.params.id);
//     if (!chat) return next(new ErrorHandler("Chat not found", 404));

//     return res.status(200).json({
//       success: true,
//       chat,
//     });
//   }
// });

// const renameGroup = TryCatch(async (req, res, next) => {
//   const chatId = req.params.id;
//   const { name } = req.body;

//   const chat = await Chat.findById(chatId);

//   if (!chat) return next(new ErrorHandler("Chat not found", 404));

//   if (!chat.groupChat)
//     return next(new ErrorHandler("This is not a group chat", 400));

//   if (chat.creator.toString() !== req.userId.toString())
//     return next(
//       new ErrorHandler("You are not allowed to rename the group", 403),
//     );

//   chat.name = name;

//   await chat.save();

//   emitEvent(req, REFETCH_CHATS, chat.members);

//   return res.status(200).json({
//     success: true,
//     message: "Group renamed successfully",
//   });
// });

// const deleteChat = TryCatch(async (req, res, next) => {
//   const chatId = req.params.id;
//   const chat = await Chat.findById(chatId);

//   if (!chat) return next(new ErrorHandler("Chat not found", 404));

//   const membersToNotify = chat.members;

//   if (chat.groupChat && chat.creator.toString() !== req.userId.toString())
//     return next(
//       new ErrorHandler("You are not allowed to delete the group", 403),
//     );

//   if (!chat.groupChat && !chat.members.includes(req.userId.toString())) {
//     return next(
//       new ErrorHandler("You are not allowed to delete the chat", 403),
//     );
//   }

//   // Delete all Messages as well as attachments or files from cloudinary

//   const messagesWithAttachments = await Message.find({
//     chat: chatId,
//     attachments: { $exists: true, $ne: [] },
//   });

//   const public_ids = [];

//   messagesWithAttachments.forEach(({ attachments }) =>
//     attachments.forEach(({ public_id }) => public_ids.push(public_id)),
//   );

//   await Promise.all([
//     deletFilesFromCloudinary(public_ids),
//     chat.deleteOne(),
//     Message.deleteMany({ chat: chatId }),
//   ]);

//   emitEvent(req, REFETCH_CHATS, membersToNotify);

//   return res.status(200).json({
//     success: true,
//     message: "Chat deleted successfully",
//   });
// });

// const getMessages = TryCatch(async (req, res, next) => {
//   const chatId = req.params.id;

//   const { page = 1 } = req.query;
//   const resultPerPage = 2;

//   const skip = (page - 1) * resultPerPage;
//   const chat = await Chat.findById(chatId);

//   if (!chat) return next(new ErrorHandler("Chat not found", 404));

//   if (!chat.members.includes(req.userId.toString()))
//     return next(
//       new ErrorHandler("You are not allowed to access this chat", 403),
//     );

//   const [messages, totalMessagesCount] = await Promise.all([
//     Message.find({ chat: chatId })
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(resultPerPage)
//       .populate("sender", "name")
//       .lean(),
//     Message.countDocuments({ chat: chatId }),
//   ]);

//   const totalPages = Math.ceil(totalMessagesCount / resultPerPage) || 0;

//   return res.status(200).json({
//     success: true,
//     messages: messages.reverse(),
//     totalPages,
//   });
// });

// export {
//   newGroupChat,
//   getMyChats,
//   getMyGroups,
//   addMembers,
//   removeMember,
//   leaveGroup,
//   sendAttachments,
//   getChatDetails,
//   renameGroup,
//   deleteChat,
//   getMessages,
// };
