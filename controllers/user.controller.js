// Login user and save token in cookie
// const login = TryCatch(async (req, res, next) => {
//   const { username, password } = req.body;

//   const user = await User.findOne({ username }).select("+password");
//   if (!user) {
//     return next(new ErrorHandler("Invalid username or password", 404));
//   }

//   const isSameUser = await compare(password, user.password);
//   if (!isSameUser) {
//     return next(new ErrorHandler("Invalid username or password", 404));
//   }
//   sendToken(res, user, 200, `Welcome Back, ${user.name}`);
// });

// const getMyProfile = TryCatch(async (req, res, next) => {
//   const user = await User.findOne({ _id: req.userId });
//   return res.status(200).json({
//     success: true,
//     message: "Test route",
//     user,
//   });
// });

// const logout = (req, res, next) => {
//   return res.cookie(env.TOKEN_KEY, "", { ...cookieOptions, maxAge: 0 }).json({
//     success: true,
//     message: "Logged out successfully",
//   });
// };

// const searchUser = TryCatch(async (req, res, next) => {
//   const { name = "" } = req.query;

//   // Get all of my chats
//   const myChats = await Chat.find({ groupChat: false, members: req.userId });

//   // Extract all my friends
//   const allUsersFromMyChats = myChats.flatMap((chat) => chat.members);

//   // Find all users matching 'name' except me and my friends
//   const allUsersExceptMeAndFriends = await User.find({
//     _id: { $nin: allUsersFromMyChats },
//     name: { $regex: name, $options: "i" },
//   });

//   const users = allUsersExceptMeAndFriends.map(({ _id, name, avatar }) => ({
//     _id,
//     name,
//     avatar: avatar.url,
//   }));

//   return res.status(200).json({
//     success: true,
//     users,
//   });
// });

// const sendChatRequest = TryCatch(async (req, res, next) => {
//   const receiverId = req.body.userId;

//   const existingRequest = await Request.findOne({
//     $or: [
//       {
//         sender: req.userId,
//         receiver: receiverId,
//       },
//       {
//         sender: receiverId,
//         receiver: req.userId,
//       },
//     ],
//   });
//   if (existingRequest)
//     return next(new ErrorHandler("Request already sent", 400));

//   await Request.create({
//     sender: req.userId,
//     receiver: receiverId,
//   });

//   emitEvent(req, NEW_REQUEST, [receiverId]);

//   return res.status(200).json({
//     success: true,
//     message: "Request sent",
//   });
// });

// const acceptChatRequest = TryCatch(async (req, res, next) => {
//   const { requestId, isRequestAccepted } = req.body;

//   const request = await Request.findById(requestId)
//     .populate("sender", "name")
//     .populate("receiver", "name");

//   if (!request) return next(new ErrorHandler("Request does not exist"));

//   if (request.receiver._id.toString() !== req.userId.toString())
//     return next(
//       new ErrorHandler("You are not authorized to accept this request", 401),
//     );

//   const members = [request.sender._id, request.receiver._id];
//   if (isRequestAccepted) {
//     await Chat.create({
//       name: `${request.sender.name} - ${request.receiver.name}`,
//       members,
//     });
//     emitEvent(req, REFETCH_CHATS, members);
//   }

//   await request.deleteOne();

//   return res.status(200).json({
//     success: true,
//     message: `Chat request ${isRequestAccepted ? "accepted" : "rejected"}`,
//     ...(isRequestAccepted ? { senderId: request.sender._id } : {}),
//   });
// });

// const getMyNotifications = TryCatch(async (req, res) => {
//   const requests = await Request.find({ receiver: req.userId }).populate(
//     "sender",
//     "name avatar",
//   );

//   const allRequests = requests.map(({ _id, sender }) => ({
//     _id,
//     sender: {
//       _id: sender._id,
//       name: sender.name,
//       avatar: sender.avatar.url,
//     },
//   }));

//   return res.status(200).json({
//     success: true,
//     allRequests,
//   });
// });

// const getMyFriends = TryCatch(async (req, res) => {
//   const { chatId } = req.query;

//   const chats = await Chat.find({
//     groupChat: false,
//     members: req.userId,
//   }).populate("members", "name avatar");

//   const friends = chats.map(({ members }) => {
//     const otherMember = getOtherMember(members, req.userId);

//     return {
//       _id: otherMember._id,
//       name: otherMember.name,
//       avatar: otherMember.avatar.url,
//     };
//   });

//   if (chatId) {
//     const chat = await Chat.findById(chatId);
//     const availableFriends = friends.filter(
//       (friend) => !chat.members.includes(friend._id),
//     );

//     return res.status(200).json({
//       success: true,
//       friends: availableFriends,
//     });
//   } else {
//     return res.status(200).json({
//       success: true,
//       friends,
//     });
//   }
// });

export // login,
// getMyProfile,
// logout,
// searchUser,
// sendChatRequest,
// acceptChatRequest,
// getMyNotifications,
// getMyFriends,
 {};
