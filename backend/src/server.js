import "dotenv/config";
import cors from "cors";
import express from "express";
import { connectDatabase } from "./db.js";
import { requireAdmin } from "./middleware/auth.js";
import { attendanceRouter } from "./routes/attendance.js";
import { authRouter } from "./routes/auth.js";
import { fingerprintRouter } from "./routes/fingerprint.js";
import { peopleRouter } from "./routes/people.js";

const app = express();
const port = Number(process.env.PORT || 5050);
const frontendOrigin = process.env.FRONTEND_ORIGIN;

app.use(cors({
  origin: frontendOrigin ? frontendOrigin.split(",").map((origin) => origin.trim()) : true,
}));
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "attendance-backend" });
});

app.use("/api/auth", authRouter);
app.use("/api/people", requireAdmin, peopleRouter);
app.use("/api/attendance", requireAdmin, attendanceRouter);
app.use("/api/fingerprint", requireAdmin, fingerprintRouter);

connectDatabase(process.env.MONGODB_URI)
  .then(() => {
    app.listen(port, () => {
      console.log(`Attendance API running on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start Attendance API.");
    console.error(error);
    process.exit(1);
  });
