import { ROLE_PERMISSIONS } from "../constants/rolePermissions.constants.js";
import { Conversation } from "../models/conversation.model.js";
import { Membership } from "../models/membership.model.js";

/**
 * Infer which scope a permission string belongs to from its prefix.
 * This is the single source of truth for scope assignment.
 *
 * 'org:*'      → 'org'
 * 'team:*'     → 'team'
 * 'channel:*'  → 'channel'
 * 'message:*'  → 'message'  (evaluated at team + channel level)
 */
function inferPermissionScope(permission) {
  const prefix = permission.split(":")[0];

  //may include error logic later

  return prefix;
}

/**
 * Check if a user has a given permission within a context.
 *
 * @param {string} userId
 * @param {string} permission  — e.g. 'message:send', 'team:delete'
 * @param {object} context     — { orgId?, teamId?, channelId?, conversationId? }
 * @returns {Promise<boolean>}
 */
async function hasPermission(userId, permission, context = {}) {
  const { orgId, teamId, channelId, conversationId } = context;

  if (conversationId) {
    const conversation = await Conversation.findById(conversationId).lean();
    if (!conversation || conversation.type !== "group") return false;

    const participant = conversation.participants.find(
      (p) => p.userId.toString() === userId.toString(),
    );
    if (!participant) return false;

    const perms = ROLE_PERMISSIONS[participant.role] ?? [];
    return perms.includes(permission);
  } else {
    // ── Step 1: Infer which scope this permission belongs to ──────────────────
    //
    // This is the guard against cross-scope bleed. A 'team:delete' check
    // will never be satisfied by a channel-level membership, even if that
    // membership somehow listed the permission.

    const permScope = inferPermissionScope(permission);

    // ── Step 2: Build the DB query — only fetch relevant memberships ──────────
    //
    // We always fetch org membership (highest authority).
    // We only fetch team/channel memberships if the permission's scope warrants it.

    const orConditions = [];

    if (orgId) {
      orConditions.push({ scope: "org", orgId });
    }

    if (teamId && ["team", "message"].includes(permScope)) {
      orConditions.push({ scope: "team", teamId });
    }

    if (channelId && ["channel", "message"].includes(permScope)) {
      orConditions.push({ scope: "channel", channelId });
    }

    if (orConditions.length === 0) return false;

    const memberships = await Membership.find({
      userId,
      $or: orConditions,
    }).lean();

    if (memberships.length === 0) return false;

    const byScope = {};
    for (const m of memberships) {
      byScope[m.scope] = m;
    }

    // ── Step 4: Evaluate org membership first (highest authority) ─────────────
    //
    // OrgOwner has wildcard — they can do anything, anywhere.
    // OrgAdmin has an explicit list that spans org + team + channel actions.
    // Other org roles (OrgMember, OrgGuest) only get their specific permissions.

    const orgMembership = byScope["org"];
    if (orgMembership) {
      const perms = ROLE_PERMISSIONS[orgMembership.role] ?? [];
      if (perms.includes("*")) return true; // OrgOwner
      if (perms.includes(permission)) return true; // OrgAdmin or OrgMember match
    }

    // ── Step 5: Evaluate team membership ──────────────────────────────────────
    //
    // Only reached for 'team' and 'message' scoped permissions.
    // TeamAdmin, TeamMember, TeamGuest are evaluated here.

    const teamMembership = byScope["team"];
    if (teamMembership) {
      const perms = ROLE_PERMISSIONS[teamMembership.role] ?? [];
      if (perms.includes(permission)) return true;
    }

    // ── Step 6: Evaluate channel membership ───────────────────────────────────
    //
    // Only reached for 'channel' and 'message' scoped permissions.
    // ChannelModerator and ChannelMember are evaluated here.
    //
    // NOTE: Channel membership ADDS permissions on top of team membership
    // (e.g. ChannelModerator can delete any message even if they're a TeamGuest).
    // It does NOT restrict — if you need restriction, change the team role instead.

    const channelMembership = byScope["channel"];
    if (channelMembership) {
      const perms = ROLE_PERMISSIONS[channelMembership.role] ?? [];
      if (perms.includes(permission)) return true;
    }
  }

  // ── Step 7: No membership granted this permission ─────────────────────────
  return false;
}

export { hasPermission };
