import { Router } from "express";
import { AttendanceRecord } from "../models/AttendanceRecord.js";
import { Person } from "../models/Person.js";
import { findBestFaceMatch } from "../utils/faceMatch.js";

export const attendanceRouter = Router();
const ATTENDANCE_TIME_ZONE = "Asia/Kolkata";

function getDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ATTENDANCE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(date));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function findTodayRecord(personId) {
  return AttendanceRecord.findOne({
    person: personId,
    attendanceDate: getDateKey(),
  });
}

attendanceRouter.get("/", async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 100), 1000);
  const query = {};

  if (req.query.from || req.query.to) {
    query.attendanceDate = {};

    if (req.query.from) {
      query.attendanceDate.$gte = String(req.query.from);
    }

    if (req.query.to) {
      query.attendanceDate.$lte = String(req.query.to);
    }
  }

  if (req.query.department && req.query.department !== "all") {
    const people = await Person.find({
      department: String(req.query.department),
      active: true,
    }).select("_id");
    query.person = { $in: people.map((person) => person._id) };
  }

  const records = await AttendanceRecord.find(query)
    .populate("person")
    .sort({ markedAt: -1 })
    .limit(limit);

  res.json({ records });
});

attendanceRouter.post("/manual", async (req, res) => {
  const person = await Person.findOne({ personCode: req.body.personCode, active: true });

  if (!person) {
    res.status(404).json({ error: "Person not found." });
    return;
  }

  const existingRecord = await findTodayRecord(person._id);

  if (existingRecord) {
    res.status(409).json({
      error: "Attendance is already marked for this profile today.",
      record: existingRecord,
      person,
    });
    return;
  }

  const record = await AttendanceRecord.create({
    person: person._id,
    personCode: person.personCode,
    attendanceDate: getDateKey(),
    method: "manual",
    status: req.body.status || "present",
    notes: req.body.notes || "",
  });

  res.status(201).json({ record, person });
});

attendanceRouter.post("/face", async (req, res) => {
  const descriptor = req.body.descriptor || [];
  const people = await Person.find({
    active: true,
    "faceProfile.descriptor.0": { $exists: true },
  });
  const match = findBestFaceMatch(descriptor, people);

  if (!match) {
    res.status(404).json({ error: "No face match found." });
    return;
  }

  const existingRecord = await findTodayRecord(match.person._id);

  if (existingRecord) {
    res.status(409).json({
      error: "Attendance is already marked for this profile today.",
      record: existingRecord,
      person: match.person,
      confidence: match.confidence,
    });
    return;
  }

  const record = await AttendanceRecord.create({
    person: match.person._id,
    personCode: match.person.personCode,
    attendanceDate: getDateKey(),
    method: "face",
    confidence: match.confidence,
  });

  res.status(201).json({ record, person: match.person, confidence: match.confidence });
});

attendanceRouter.post("/fingerprint", async (_req, res) => {
  res.status(501).json({
    error: "Fingerprint device is not configured yet. Choose a scanner SDK before enabling this endpoint.",
  });
});
