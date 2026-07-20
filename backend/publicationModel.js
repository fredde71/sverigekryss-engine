const {
  normalizeCrosswordId,
  getCrosswordIdValidationError
} = require("./crosswordIdValidation");
const {
  normalizePublicationId,
  getPublicationIdValidationError
} = require("./publicationIdValidation");

function normalizePublication(input = {}) {
  return {
    publicationId: normalizePublicationId(input.publicationId),
    crosswordId: normalizeCrosswordId(input.crosswordId),
    newspaper: normalizeOptionalString(input.newspaper),
    group: normalizeOptionalString(input.group),
    publishDate: normalizeOptionalString(input.publishDate),
    publishWeek: normalizeOptionalString(input.publishWeek),
    status: normalizeOptionalString(input.status) || "draft",
    url: normalizeOptionalString(input.url),
    statistics: normalizeStatistics(input.statistics)
  };
}

function createPublication(input = {}) {
  const publication = normalizePublication(input);
  const errors = getPublicationValidationErrors(publication);

  if (errors.length > 0) {
    throw new Error(errors[0]);
  }

  return publication;
}

function getPublicationValidationErrors(input = {}) {
  const publicationIdError = getPublicationIdValidationError(input.publicationId);
  const crosswordIdError = getCrosswordIdValidationError(input.crosswordId);
  const errors = [];

  if (publicationIdError) {
    errors.push(publicationIdError);
  }

  if (crosswordIdError) {
    errors.push(crosswordIdError);
  }

  return errors;
}

function normalizeOptionalString(value) {
  if (value == null) return "";

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }

  if (typeof value !== "string") return "";

  return value.trim();
}

function normalizeStatistics(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return { ...value };
}

module.exports = {
  createPublication,
  normalizePublication,
  getPublicationValidationErrors
};
