import { authenticator } from "otplib";
const BASE32_REGEX = /^[A-Z2-7]+=*$/;
export function normalizeSecret(secret = "") {
  return String(secret).replace(/\s+/g, "").toUpperCase();
}
export function isValidBase32(secret) {
  const normalized = normalizeSecret(secret);
  return normalized.length > 0 && BASE32_REGEX.test(normalized);
}
export function generateToken(secret) {
  const normalized = normalizeSecret(secret);
  if (BASE32_REGEX.test(normalized)) {
    return authenticator.generate(normalized);
  }
  return false;
}
