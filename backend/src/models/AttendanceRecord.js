import mongoose from "mongoose";

const attendanceRecordSchema = new mongoose.Schema(
  {
    person: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Person",
      required: true,
    },
    personCode: {
      type: String,
      required: true,
      trim: true,
    },
    markedAt: {
      type: Date,
      default: Date.now,
    },
    attendanceDate: {
      type: String,
      required: true,
      trim: true,
    },
    method: {
      type: String,
      enum: ["face", "fingerprint", "manual"],
      required: true,
    },
    status: {
      type: String,
      enum: ["present", "late", "absent"],
      default: "present",
    },
    confidence: {
      type: Number,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true },
);

attendanceRecordSchema.index({ person: 1, attendanceDate: 1 }, { unique: true });

export const AttendanceRecord = mongoose.model("AttendanceRecord", attendanceRecordSchema);
