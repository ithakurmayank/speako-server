const GROUP_MESSAGE_STATUS = Object.freeze({
  DELIVERED: "delivered",
  SEEN: "seen",
});

const GROUP_MESSAGE_STATUS_VALUES = Object.values(GROUP_MESSAGE_STATUS);

const MESSAGE_TYPES = Object.freeze({
  TEXT: "text",
  SYSTEM: "system",
  FILE: "file",
  IMAGE: "image",
});

const MESSAGE_TYPES_VALUES = Object.values(MESSAGE_TYPES);

export {
  GROUP_MESSAGE_STATUS,
  GROUP_MESSAGE_STATUS_VALUES,
  MESSAGE_TYPES,
  MESSAGE_TYPES_VALUES,
};
