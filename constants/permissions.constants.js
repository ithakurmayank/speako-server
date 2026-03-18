const PERMISSIONS = Object.freeze({
  // ── Org-level ──────────────────────────────────────
  ORG_SETTINGS_EDIT: "org:settings:edit",
  ORG_BILLING: "org:billing",
  ORG_AUDIT_LOG_VIEW: "org:auditlog:view",
  ORG_MEMBERS_INVITE: "org:members:invite",
  ORG_MEMBERS_REMOVE: "org:members:remove",
  ORG_MEMBERS_ROLE_CHANGE: "org:members:role:change",
  ORG_TEAMS_CREATE: "org:teams:create",
  ORG_TEAMS_DELETE: "org:teams:delete",

  // ── Team-level ─────────────────────────────────────
  TEAM_SETTINGS_EDIT: "team:settings:edit",
  TEAM_DELETE: "team:delete",
  TEAM_ARCHIVE: "team:archive",
  TEAM_MEMBERS_INVITE: "team:members:invite",
  TEAM_MEMBERS_KICK: "team:members:kick",
  TEAM_MEMBERS_ROLE_CHANGE: "team:members:role:change",
  TEAM_CHANNELS_CREATE: "team:channels:create",
  TEAM_CHANNELS_DELETE: "team:channels:delete",
  TEAM_CHANNELS_ARCHIVE: "team:channels:archive",

  // ── Channel-level ──────────────────────────────────
  CHANNEL_SETTINGS_EDIT: "channel:settings:edit",
  CHANNEL_MEMBERS_ADD: "channel:members:add",
  CHANNEL_MEMBERS_REMOVE: "channel:members:remove",
  CHANNEL_MEMBERS_ROLE_CHANGE: "channel:members:role:change",

  // ── Message-level ──────────────────────────────────
  MESSAGE_SEND: "message:send",
  MESSAGE_EDIT_OWN: "message:edit:own",
  MESSAGE_DELETE_OWN: "message:delete:own",
  MESSAGE_DELETE_ANY: "message:delete:any",
  MESSAGE_PIN: "message:pin",
  MESSAGE_REACT: "message:react",
  MESSAGE_THREAD_REPLY: "message:thread:reply",

  // ── Group Chat-level ───────────────────────────────
  GROUP_SETTINGS_EDIT: "groupchat:settings:edit",
  GROUP_MEMBERS_ADD: "groupchat:members:add",
  GROUP_MEMBERS_REMOVE: "groupchat:members:remove",
  GROUP_MEMBERS_ROLE_CHANGE: "groupchat:members:role:change",
  GROUP_DELETE: "groupchat:delete",
});

export { PERMISSIONS };
