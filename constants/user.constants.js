const USER_STATUS = Object.freeze({
  ONLINE: "online",
  OFFLINE: "offline",
  AWAY: "away",
});

const USER_STATUS_VALUES = Object.values(USER_STATUS);

const USER_CUSTOM_STATUS = Object.freeze({
  ACTIVE: "active",
  BUSY: "busy",
  DO_NOT_DISTURB: "do_not_disturb",
  BE_RIGHT_BACK: "be_right_back",
  APPEAR_AWAY: "appear_away",
  APPEAR_OFFLINE: "appear_offline",
});

const USER_CUSTOM_STATUS_VALUES = Object.values(USER_CUSTOM_STATUS);

const MEMBER_SCOPES = Object.freeze({
  ORG: "org",
  TEAM: "team",
  CHANNEL: "channel",
});

const MEMBER_SCOPES_VALUES = Object.values(MEMBER_SCOPES);

export {
  USER_STATUS,
  USER_STATUS_VALUES,
  USER_CUSTOM_STATUS,
  USER_CUSTOM_STATUS_VALUES,
  MEMBER_SCOPES,
  MEMBER_SCOPES_VALUES,
};
