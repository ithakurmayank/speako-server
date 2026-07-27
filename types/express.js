/**
 * @typedef {Object} RequestContext
 * @property {string | null} orgId
 * @property {string | null} [teamId]
 * @property {string | null} [channelId]
 * @property {string | null} [conversationId]
 */

/**
 * @typedef {import("express").Request & {
 *   userId: string;
 *   context: RequestContext;
 * }} Request
 */

/**
 * @typedef {import("express").Response} Response
 */

/**
 * @typedef {import("express").NextFunction} NextFunction
 */

export {};
