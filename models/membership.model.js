import mongoose, { model, Schema, Types } from "mongoose";
import { MEMBER_SCOPES_VALUES } from "../constants/user.constants.js";
import { ORG_ROLES_VALUES } from "../constants/roles.constants.js";
import { ErrorHandler } from "#utils/errorHandler.util.js";
import { EXCEPTION_CODES } from "#constants/exceptionCodes.constants.js";

const { ObjectId } = Types;

// NOTE: No membership is created for public channel, they come from team membership
const membershipSchema = new Schema(
  {
    userId: { type: ObjectId, ref: "User", required: true },

    // Exactly ONE of these is set depending on scope:
    orgId: { type: ObjectId, ref: "Organization" },
    teamId: { type: ObjectId, ref: "Team" },
    channelId: { type: ObjectId, ref: "Channel" },

    scope: {
      type: String,
      enum: MEMBER_SCOPES_VALUES,
      required: true,
    },

    role: {
      type: String,
      enum: ORG_ROLES_VALUES,
      required: true,
    },

    isMuted: { type: Boolean, default: false },

    invitedBy: { type: ObjectId, ref: "User", default: null },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

membershipSchema.index(
  { userId: 1, orgId: 1, scope: 1 },
  {
    unique: true,
    partialFilterExpression: { orgId: { $exists: true } },
  },
);

membershipSchema.index(
  { userId: 1, teamId: 1, scope: 1 },
  {
    unique: true,
    partialFilterExpression: { teamId: { $exists: true } },
  },
);

membershipSchema.index(
  { userId: 1, channelId: 1, scope: 1 },
  {
    unique: true,
    partialFilterExpression: { channelId: { $exists: true } },
  },
);
membershipSchema.index({ teamId: 1, scope: 1 }); // list all members of a team
membershipSchema.index({ channelId: 1, scope: 1 }); // list all members of a channel
membershipSchema.index({ userId: 1, scope: 1 }); // all teams/orgs a user belongs to (sidebar)

membershipSchema.pre("validate", function () {
  // org scope: only orgId set
  if (this.scope === MEMBER_SCOPES.ORG) {
    if (!this.orgId)
      throw new ErrorHandler(
        "orgId is required when scope is 'org'",
        EXCEPTION_CODES.INTERNAL_SERVER_ERROR,
      );
    if (this.teamId || this.channelId)
      throw new ErrorHandler(
        "teamId and channelId must not be set when scope is 'org'",
        EXCEPTION_CODES.INTERNAL_SERVER_ERROR,
      );
  }

  // team scope: teamId + orgId (denormalized), no channelId
  if (this.scope === MEMBER_SCOPES.TEAM) {
    if (!this.teamId)
      throw new ErrorHandler(
        "teamId is required when scope is 'team'",
        EXCEPTION_CODES.INTERNAL_SERVER_ERROR,
      );
    if (!this.orgId)
      throw new ErrorHandler(
        "orgId is required when scope is 'team' (denormalized)",
        EXCEPTION_CODES.INTERNAL_SERVER_ERROR,
      );
    if (this.channelId)
      throw new ErrorHandler(
        "channelId must not be set when scope is 'team'",
        EXCEPTION_CODES.INTERNAL_SERVER_ERROR,
      );
  }

  // channel scope: channelId + teamId + orgId (denormalized), all three required
  if (this.scope === MEMBER_SCOPES.CHANNEL) {
    if (!this.channelId)
      throw new ErrorHandler(
        "channelId is required when scope is 'channel'",
        EXCEPTION_CODES.INTERNAL_SERVER_ERROR,
      );
    if (!this.teamId)
      throw new ErrorHandler(
        "teamId is required when scope is 'channel' (denormalized)",
        EXCEPTION_CODES.INTERNAL_SERVER_ERROR,
      );
    if (!this.orgId)
      throw new ErrorHandler(
        "orgId is required when scope is 'channel' (denormalized)",
        EXCEPTION_CODES.INTERNAL_SERVER_ERROR,
      );
  }
});

export const Membership =
  mongoose.models.Membership || model("Membership", membershipSchema);
