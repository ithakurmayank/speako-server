const GROUP_MESSAGE_STATUS = Object.freeze({
  DELIVERED: "delivered",
  SEEN: "seen",
});

const GROUP_MESSAGE_STATUS_VALUES = Object.values(GROUP_MESSAGE_STATUS);

const DM_MESSAGE_STATUS = Object.freeze({
  DELIVERED: "delivered",
  SEEN: "seen",
  SENT: "sent",
  SENDING: "sending",
});

const DM_MESSAGE_STATUS_VALUES = Object.values(DM_MESSAGE_STATUS);

export {
  DM_MESSAGE_STATUS,
  DM_MESSAGE_STATUS_VALUES,
  GROUP_MESSAGE_STATUS,
  GROUP_MESSAGE_STATUS_VALUES,
};
