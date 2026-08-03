/**
 * TODO (next step): port HubAuthorizationService.
 *
 * Will expose:
 *   canAccessChannel(userId, channelId)
 *   canAccessConversation(userId, conversationId)
 *
 * Planned translation (per confirmed schema mapping):
 *   - Channel access: replace the 3-table join (ChannelMembers /
 *     TeamMembers / OrganizationMembers) with queries against the single
 *     Membership collection (scope: "org" | "team" | "channel") plus the
 *     Channel.isPrivate flag — public channel = active team membership,
 *     private channel = explicit channel membership OR org admin/owner OR
 *     team admin.
 *   - Conversation access: Direct = user is directParticipantAId/BId;
 *     Group = active (hasLeft: false) ConversationParticipant row.
 *   - Same 30s-cache-with-10s-sliding-expiration behavior as the dotnet
 *     IMemoryCache usage — will use a small TTL cache (e.g. a Map with
 *     timestamps, or the `lru-cache` package) keyed by
 *     `${userId}:${channelId}` / `${userId}:${conversationId}`.
 */

const canAccessChannel = async (userId, channelId) => {
  throw new Error("Not implemented yet — see TODO in hubAuthorization.service.js");
};

const canAccessConversation = async (userId, conversationId) => {
  throw new Error("Not implemented yet — see TODO in hubAuthorization.service.js");
};

export { canAccessChannel, canAccessConversation };
