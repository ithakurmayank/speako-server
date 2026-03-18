const OTHER_ROLES = Object.freeze({
  OrgOwner: "OrgOwner",
  OrgAdmin: "OrgAdmin",
  OrgMember: "OrgMember",
  OrgGuest: "OrgGuest",
  TeamAdmin: "TeamAdmin",
  TeamMember: "TeamMember",
  TeamGuest: "TeamGuest",
  ChannelModerator: "ChannelModerator",
  ChannelMember: "ChannelMember",
  ChannelReadOnly: "ChannelReadOnly",
});

const OTHER_ROLES_VALUES = Object.values(OTHER_ROLES);

const GROUP_ROLES = Object.freeze({
  GroupAdmin: "GroupAdmin",
  GroupMember: "GroupMember",
});

const GROUP_ROLES_VALUES = Object.values(GROUP_ROLES);

const ALL_ROLES = Object.freeze({
  ...GROUP_ROLES,
  ...OTHER_ROLES,
});

export {
  OTHER_ROLES,
  OTHER_ROLES_VALUES,
  GROUP_ROLES,
  GROUP_ROLES_VALUES,
  ALL_ROLES,
};
