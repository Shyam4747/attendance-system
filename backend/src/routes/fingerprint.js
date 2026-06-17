import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { Router } from "express";
import { AttendanceRecord } from "../models/AttendanceRecord.js";
import { Person } from "../models/Person.js";
import { WebAuthnChallenge } from "../models/WebAuthnChallenge.js";
import {
  getExpectedOrigins,
  getExpectedRpIds,
  getPrimaryRpId,
  personCredential,
  RP_NAME,
  toBase64Url,
} from "../utils/webauthn.js";

export const fingerprintRouter = Router();

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

async function findPerson(personId) {
  if (!personId) {
    return null;
  }

  return Person.findOne({ _id: personId, active: true });
}

async function latestChallenge(personId, type) {
  return WebAuthnChallenge.findOne({ person: personId, type }).sort({ createdAt: -1 });
}

fingerprintRouter.post("/register/options", async (req, res) => {
  const person = await findPerson(req.body.personId);

  if (!person) {
    res.status(404).json({ error: "Profile not found." });
    return;
  }

  const existingCredential = personCredential(person);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: getPrimaryRpId(),
    userID: new TextEncoder().encode(String(person._id)),
    userName: person.personCode,
    userDisplayName: person.name,
    attestationType: "none",
    excludeCredentials: existingCredential
      ? [{ id: existingCredential.id, transports: existingCredential.transports }]
      : [],
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
    },
  });

  await WebAuthnChallenge.deleteMany({ person: person._id, type: "registration" });
  await WebAuthnChallenge.create({
    challenge: options.challenge,
    type: "registration",
    person: person._id,
  });

  res.json({ options });
});

fingerprintRouter.post("/register/verify", async (req, res) => {
  const person = await findPerson(req.body.personId);

  if (!person) {
    res.status(404).json({ error: "Profile not found." });
    return;
  }

  const challenge = await latestChallenge(person._id, "registration");

  if (!challenge) {
    res.status(400).json({ error: "Fingerprint registration expired. Try again." });
    return;
  }

  const verification = await verifyRegistrationResponse({
    response: req.body.response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: getExpectedOrigins(),
    expectedRPID: getExpectedRpIds(),
    requireUserVerification: true,
  });

  if (!verification.verified || !verification.registrationInfo) {
    res.status(400).json({ error: "Fingerprint registration could not be verified." });
    return;
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  person.fingerprintProfile = {
    ...person.fingerprintProfile?.toObject?.(),
    deviceType: "phone_webauthn",
    templateId: credential.id,
    status: "registered",
    credentialId: credential.id,
    credentialPublicKey: toBase64Url(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports || [],
    credentialDeviceType,
    credentialBackedUp,
    registeredAt: new Date(),
  };
  await person.save();
  await WebAuthnChallenge.deleteMany({ person: person._id, type: "registration" });

  res.json({ person });
});

fingerprintRouter.post("/attendance/options", async (req, res) => {
  const person = await findPerson(req.body.personId);

  if (!person) {
    res.status(404).json({ error: "Profile not found." });
    return;
  }

  const credential = personCredential(person);

  if (!credential) {
    res.status(409).json({ error: "Register this phone fingerprint before marking attendance." });
    return;
  }

  const options = await generateAuthenticationOptions({
    rpID: getPrimaryRpId(),
    allowCredentials: [{ id: credential.id, transports: credential.transports }],
    userVerification: "required",
  });

  await WebAuthnChallenge.deleteMany({ person: person._id, type: "authentication" });
  await WebAuthnChallenge.create({
    challenge: options.challenge,
    type: "authentication",
    person: person._id,
  });

  res.json({ options });
});

fingerprintRouter.post("/attendance/verify", async (req, res) => {
  const person = await findPerson(req.body.personId);

  if (!person) {
    res.status(404).json({ error: "Profile not found." });
    return;
  }

  const credential = personCredential(person);

  if (!credential) {
    res.status(409).json({ error: "Register this phone fingerprint before marking attendance." });
    return;
  }

  const challenge = await latestChallenge(person._id, "authentication");

  if (!challenge) {
    res.status(400).json({ error: "Fingerprint attendance request expired. Try again." });
    return;
  }

  const verification = await verifyAuthenticationResponse({
    response: req.body.response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: getExpectedOrigins(),
    expectedRPID: getExpectedRpIds(),
    credential,
    requireUserVerification: true,
  });

  if (!verification.verified) {
    res.status(400).json({ error: "Fingerprint verification failed." });
    return;
  }

  person.fingerprintProfile.counter = verification.authenticationInfo.newCounter;
  person.fingerprintProfile.credentialDeviceType = verification.authenticationInfo.credentialDeviceType;
  person.fingerprintProfile.credentialBackedUp = verification.authenticationInfo.credentialBackedUp;
  await person.save();
  await WebAuthnChallenge.deleteMany({ person: person._id, type: "authentication" });

  const existingRecord = await AttendanceRecord.findOne({
    person: person._id,
    attendanceDate: getDateKey(),
  });

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
    method: "fingerprint",
    confidence: 1,
  });

  res.status(201).json({ record, person });
});
