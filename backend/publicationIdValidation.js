const PUBLICATION_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const MAX_PUBLICATION_ID_LENGTH = 64;

function normalizePublicationId(value) {
  if (typeof value !== "string") {
    return value;
  }

  return value.trim();
}

function getPublicationIdValidationError(value) {
  if (value == null) {
    return "Missing publicationId";
  }

  if (typeof value !== "string") {
    return "Invalid publicationId";
  }

  const normalized = normalizePublicationId(value);

  if (!normalized) {
    return "Missing publicationId";
  }

  if (normalized.length > MAX_PUBLICATION_ID_LENGTH) {
    return "Invalid publicationId";
  }

  if (!PUBLICATION_ID_PATTERN.test(normalized)) {
    return "Invalid publicationId";
  }

  return null;
}

module.exports = {
  normalizePublicationId,
  getPublicationIdValidationError
};
