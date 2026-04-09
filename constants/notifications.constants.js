const NOTIFICATION_TYPES = Object.freeze({
  MENTION: "mention",
  THREAD_REPLY: "thread_reply",
  REACTION: "reaction",
  DM: "dm",
  GROUP_MESSAGE: "group_message",
  ADDED_TO_TEAM: "added_to_team",
  ADDED_TO_CHANNEL: "added_to_channel",
  ADDED_TO_GROUP: "added_to_group",
});

const NOTIFICATION_TYPE_VALUES = Object.values(NOTIFICATION_TYPES);

export { NOTIFICATION_TYPES, NOTIFICATION_TYPE_VALUES };
