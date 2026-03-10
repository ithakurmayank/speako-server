import mongoose, { model, Schema, Types } from "mongoose";

const { ObjectId } = Types;

const membershipSchema = new Schema(
  {
    userId: { type: ObjectId, ref: "User", required: true },

    // Exactly ONE of these is set depending on scope:
    orgId: { type: ObjectId, ref: "Organization", default: null },
    teamId: { type: ObjectId, ref: "Team", default: null },
    channelId: { type: ObjectId, ref: "Channel", default: null },

    scope: {
      type: String,
      enum: ["org", "team", "channel"],
      required: true,
    },

    role: {
      type: String,
      enum: [
        "OrgOwner",
        "OrgAdmin",
        "OrgMember",
        "OrgGuest",
        "TeamAdmin",
        "TeamMember",
        "TeamGuest",
        "ChannelModerator",
        "ChannelMember",
        "ChannelReadOnly",
      ],
      required: true,
    },

    isMuted: { type: Boolean, default: false },

    invitedBy: { type: ObjectId, ref: "User", default: null },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// sparse: true required because most docs only have ONE of the three ID fields set
membershipSchema.index(
  { userId: 1, orgId: 1, scope: 1 },
  { unique: true, sparse: true },
);
membershipSchema.index(
  { userId: 1, teamId: 1, scope: 1 },
  { unique: true, sparse: true },
);
membershipSchema.index(
  { userId: 1, channelId: 1, scope: 1 },
  { unique: true, sparse: true },
);
membershipSchema.index({ teamId: 1, scope: 1 }); // list all members of a team
membershipSchema.index({ channelId: 1, scope: 1 }); // list all members of a channel
membershipSchema.index({ userId: 1, scope: 1 }); // all teams/orgs a user belongs to (sidebar)

export const Membership =
  mongoose.models.Membership || model("Membership", membershipSchema);
