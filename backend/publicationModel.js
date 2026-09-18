const {
  normalizeCrosswordId,
  getCrosswordIdValidationError
} = require("./crosswordIdValidation");
const {
  normalizePublicationId,
  getPublicationIdValidationError
} = require("./publicationIdValidation");
const { normalizeHelpAccessToken } = require("./helpAccessToken");

function normalizePublication(input = {}) {
  const publication = {
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
  const snapshot = normalizeCrosswordSnapshot(input.crosswordSnapshot);

  if (snapshot) {
    publication.crosswordSnapshot = snapshot;
  }

  const helpAccessToken = normalizeHelpAccessToken(input.helpAccessToken);
  if (helpAccessToken) {
    publication.helpAccessToken = helpAccessToken;
    publication.helpAccessStatus = input.helpAccessStatus === "active"
      ? "active"
      : "inactive";
  }

  return publication;
}

function createPublication(input = {}) {
  const publication = normalizePublication(input);
  const errors = getPublicationValidationErrors({
    ...publication,
    ...(Object.hasOwn(input, "crosswordSnapshot") ? {
      crosswordSnapshot: input.crosswordSnapshot
    } : {}),
    ...(Object.hasOwn(input, "helpAccessToken") ? {
      helpAccessToken: input.helpAccessToken
    } : {})
  });

  if (errors.length > 0) {
    throw new Error(errors[0]);
  }

  return publication;
}

function getPublicationValidationErrors(input = {}, {
  requirePublicationId = true
} = {}) {
  const crosswordIdError = getCrosswordIdValidationError(input.crosswordId);
  const errors = [];

  if (requirePublicationId || hasPublicationId(input.publicationId)) {
    const publicationIdError = getPublicationIdValidationError(input.publicationId);

    if (publicationIdError) {
    errors.push(publicationIdError);
    }
  }

  if (crosswordIdError) {
    errors.push(crosswordIdError);
  }

  if (input.crosswordSnapshot != null) {
    const snapshot = normalizeCrosswordSnapshot(input.crosswordSnapshot);
    if (!snapshot || snapshot.crosswordId !== normalizeCrosswordId(input.crosswordId)) {
      errors.push("Invalid crosswordSnapshot");
    }
  }

  if (input.helpAccessToken != null && !normalizeHelpAccessToken(input.helpAccessToken)) {
    errors.push("Invalid helpAccessToken");
  }

  return errors;
}

function hasPublicationId(value) {
  if (value == null) return false;

  if (typeof value !== "string") return true;

  return value.trim().length > 0;
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

function normalizeCrosswordSnapshot(value) {
  if (
    value?.type !== "crossword-snapshot"
    || value?.version !== 1
    || !value.template
    || typeof value.template !== "object"
  ) {
    return null;
  }

  const crosswordId = normalizeCrosswordId(
    value.crosswordId || value.template.crosswordId
  );
  if (!crosswordId || normalizeCrosswordId(value.template.crosswordId) !== crosswordId) {
    return null;
  }

  return {
    type: "crossword-snapshot",
    version: 1,
    crosswordId,
    template: structuredClone(value.template)
  };
}

module.exports = {
  createPublication,
  normalizePublication,
  getPublicationValidationErrors
};
