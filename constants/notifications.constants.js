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

// Outbox Notification Services
export const OUTBOX_MESSAGE_TYPES = {
  ORG_INVITATION_EMAIL: "org.invitation.email",
  ORG_INVITATION_SMS: "org.invitation.sms",
};

export const OUTBOX_CONFIG = {
  MAX_RETRIES: 5,
  POLL_INTERVAL_MS: 15000,
};

export { NOTIFICATION_TYPES, NOTIFICATION_TYPE_VALUES };
