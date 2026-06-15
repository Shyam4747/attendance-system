import mongoose from "mongoose";

const personSchema = new mongoose.Schema(
  {
    personCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["student", "employee"],
      default: "student",
    },
    department: {
      type: String,
      trim: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    faceProfile: {
      descriptor: {
        type: [Number],
        default: [],
      },
      imageDataUrl: {
        type: String,
        default: "",
      },
      registeredAt: Date,
    },
    fingerprintProfile: {
      deviceType: {
        type: String,
        default: "",
      },
      templateId: {
        type: String,
        default: "",
      },
      status: {
        type: String,
        enum: ["not_configured", "pending_device", "registered"],
        default: "pending_device",
      },
      registeredAt: Date,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

export const Person = mongoose.model("Person", personSchema);
