const sessionLifetimeMs = 30_000;

type DeviceSession = {
  fingerprint: string;
  expiresAt: number;
};

const deviceTokens = new Map<string, string>();
let currentSession: DeviceSession | undefined;
let csrfToken: string | undefined;
let tokenSequence = 0;

export function issueCsrfToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));

  csrfToken = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return csrfToken;
}

export function isCurrentCsrfToken(token: string | null) {
  return csrfToken !== undefined && token === csrfToken;
}

export function createDeviceSessionToken(fingerprint: string) {
  tokenSequence += 1;
  const token = `device_session_${tokenSequence}`;

  deviceTokens.set(token, fingerprint);

  return token;
}

export function issueSession(token: string, fingerprint: string) {
  if (deviceTokens.get(token) !== fingerprint) {
    return false;
  }

  currentSession = {
    fingerprint,
    expiresAt: Date.now() + sessionLifetimeMs,
  };

  return true;
}

export function hasActiveSession() {
  return currentSession !== undefined && currentSession.expiresAt > Date.now();
}

export function rotateSession(fingerprint: string) {
  if (currentSession?.fingerprint !== fingerprint) {
    return false;
  }

  currentSession.expiresAt = Date.now() + sessionLifetimeMs;

  return true;
}

export function revokeSession(fingerprint: string) {
  if (currentSession?.fingerprint === fingerprint) {
    currentSession = undefined;

    for (const [token, tokenFingerprint] of deviceTokens) {
      if (tokenFingerprint === fingerprint) {
        deviceTokens.delete(token);
      }
    }
  }
}
