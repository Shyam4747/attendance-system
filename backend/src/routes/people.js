import { Router } from "express";
import { AttendanceRecord } from "../models/AttendanceRecord.js";
import { Person } from "../models/Person.js";

export const peopleRouter = Router();

peopleRouter.get("/", async (_req, res) => {
  const people = await Person.find().sort({ createdAt: -1 });
  res.json({ people });
});

peopleRouter.post("/", async (req, res) => {
  const person = await Person.create({
    personCode: req.body.personCode,
    name: req.body.name,
    role: req.body.role || "student",
    department: req.body.department || "",
    phone: req.body.phone || "",
  });

  res.status(201).json({ person });
});

peopleRouter.patch("/:id", async (req, res) => {
  const person = await Person.findByIdAndUpdate(
    req.params.id,
    {
      personCode: req.body.personCode,
      name: req.body.name,
      role: req.body.role || "student",
      department: req.body.department || "",
      phone: req.body.phone || "",
    },
    { new: true, runValidators: true },
  );

  if (!person) {
    res.status(404).json({ error: "Person not found." });
    return;
  }

  res.json({ person });
});

peopleRouter.delete("/:id", async (req, res) => {
  const person = await Person.findByIdAndDelete(req.params.id);

  if (!person) {
    res.status(404).json({ error: "Person not found." });
    return;
  }

  const attendanceResult = await AttendanceRecord.deleteMany({ person: person._id });

  res.json({
    person,
    deletedAttendanceRecords: attendanceResult.deletedCount || 0,
  });
});

peopleRouter.patch("/:id/face-profile", async (req, res) => {
  const person = await Person.findByIdAndUpdate(
    req.params.id,
    {
      faceProfile: {
        descriptor: req.body.descriptor || [],
        imageDataUrl: req.body.imageDataUrl || "",
        registeredAt: new Date(),
      },
    },
    { new: true },
  );

  if (!person) {
    res.status(404).json({ error: "Person not found." });
    return;
  }

  res.json({ person });
});

peopleRouter.patch("/:id/fingerprint-placeholder", async (req, res) => {
  const person = await Person.findByIdAndUpdate(
    req.params.id,
    {
      fingerprintProfile: {
        deviceType: req.body.deviceType || "undecided",
        templateId: req.body.templateId || "",
        status: "pending_device",
        registeredAt: null,
      },
    },
    { new: true },
  );

  if (!person) {
    res.status(404).json({ error: "Person not found." });
    return;
  }

  res.json({ person });
});
