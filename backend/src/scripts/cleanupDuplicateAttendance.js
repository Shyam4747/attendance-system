import "dotenv/config";
import { connectDatabase } from "../db.js";
import { AttendanceRecord } from "../models/AttendanceRecord.js";

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

await connectDatabase(process.env.MONGODB_URI);

const records = await AttendanceRecord.find().sort({ markedAt: 1 });
const keepByPersonDate = new Map();
const deleteIds = [];

for (const record of records) {
  const attendanceDate = record.attendanceDate || getDateKey(record.markedAt);
  record.attendanceDate = attendanceDate;

  const key = `${record.person.toString()}-${attendanceDate}`;

  if (keepByPersonDate.has(key)) {
    deleteIds.push(record._id);
    continue;
  }

  keepByPersonDate.set(key, record._id);
  await record.save();
}

if (deleteIds.length) {
  await AttendanceRecord.deleteMany({ _id: { $in: deleteIds } });
}

await AttendanceRecord.syncIndexes();

console.log(`Cleaned duplicate attendance records: ${deleteIds.length}`);
console.log(`Unique attendance records kept: ${keepByPersonDate.size}`);
process.exit(0);
