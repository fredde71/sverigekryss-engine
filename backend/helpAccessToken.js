const crypto = require("node:crypto");

const HELP_ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

function createHelpAccessToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function normalizeHelpAccessToken(value) {
  if (typeof value !== "string") return "";

  const normalized = value.trim();
  return HELP_ACCESS_TOKEN_PATTERN.test(normalized) ? normalized : "";
}

function helpAccessTokensMatch(expected, provided) {
  const normalizedExpected = normalizeHelpAccessToken(expected);
  const normalizedProvided = normalizeHelpAccessToken(provided);
  if (!normalizedExpected || !normalizedProvided) return false;

  const expectedBuffer = Buffer.from(normalizedExpected);
  const providedBuffer = Buffer.from(normalizedProvided);
  return expectedBuffer.length === providedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

module.exports = {
  createHelpAccessToken,
  helpAccessTokensMatch,
  normalizeHelpAccessToken
};
