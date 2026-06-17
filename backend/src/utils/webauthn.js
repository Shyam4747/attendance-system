export const RP_NAME = "ProJenius Attendance";

const DEFAULT_FRONTEND_ORIGIN = "http://localhost:5173";

export function getExpectedOrigins() {
  const origins = (process.env.FRONTEND_ORIGIN || DEFAULT_FRONTEND_ORIGIN)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length ? origins : [DEFAULT_FRONTEND_ORIGIN];
}

export function getExpectedRpIds() {
  return Array.from(
    new Set(
      getExpectedOrigins().map((origin) => {
        try {
          return new URL(origin).hostname;
        } catch (_error) {
          return "localhost";
        }
      }),
    ),
  );
}

export function getPrimaryRpId() {
  return getExpectedRpIds()[0] || "localhost";
}

export function toBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

export function fromBase64Url(value) {
  return new Uint8Array(Buffer.from(value, "base64url"));
}

export function personCredential(person) {
  const profile = person.fingerprintProfile || {};

  if (!profile.credentialId || !profile.credentialPublicKey) {
    return null;
  }

  return {
    id: profile.credentialId,
    publicKey: fromBase64Url(profile.credentialPublicKey),
    counter: profile.counter || 0,
    transports: profile.transports || [],
  };
}
