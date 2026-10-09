const fingerprintStorageKey = "smart-sender:fingerprint";

export function getFingerprint() {
  const storedFingerprint = localStorage.getItem(fingerprintStorageKey);

  if (storedFingerprint && /^[a-f\d]{32}$/i.test(storedFingerprint)) {
    return storedFingerprint;
  }

  const fingerprint = createFingerprint();

  localStorage.setItem(fingerprintStorageKey, fingerprint);

  return fingerprint;
}

function createFingerprint() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}
