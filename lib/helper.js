const getOtherMember = (members, userId) =>
  members.find(({ _id }) => _id.toString() !== userId.toString());

export { getOtherMember };
