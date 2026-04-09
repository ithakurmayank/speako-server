const ORG_ROLES = Object.freeze({
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

const ORG_ROLES_VALUES = /** @type {string[]} */ (Object.values(ORG_ROLES));

const GROUP_ROLES = Object.freeze({
  GroupAdmin: "GroupAdmin",
  GroupMember: "GroupMember",
});

const GROUP_ROLES_VALUES = /** @type {string[]} */ (Object.values(GROUP_ROLES));

const ALL_ROLES = Object.freeze({
  ...GROUP_ROLES,
  ...ORG_ROLES,
});

const ALL_ROLES_VALUES = /** @type {string[]} */ (Object.values(ALL_ROLES));

export {
  ORG_ROLES,
  ORG_ROLES_VALUES,
  GROUP_ROLES,
  GROUP_ROLES_VALUES,
  ALL_ROLES,
  ALL_ROLES_VALUES,
};
