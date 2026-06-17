import mongoose from "mongoose";

const webAuthnChallengeSchema = new mongoose.Schema(
  {
    challenge: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["registration", "authentication"],
      required: true,
    },
    person: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Person",
      required: true,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 5 * 60 * 1000),
      expires: 0,
    },
  },
  { timestamps: true },
);

webAuthnChallengeSchema.index({ person: 1, type: 1, createdAt: -1 });

export const WebAuthnChallenge = mongoose.model("WebAuthnChallenge", webAuthnChallengeSchema);
