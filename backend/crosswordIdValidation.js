const CROSSWORD_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const MAX_CROSSWORD_ID_LENGTH = 64;

function normalizeCrosswordId(value) {
  if (typeof value !== "string") {
    return value;
  }

  return value.trim();
}

function getCrosswordIdValidationError(value) {
  if (value == null) {
    return "Missing crosswordId";
  }

  if (typeof value !== "string") {
    return "Invalid crosswordId";
  }

  const normalized = normalizeCrosswordId(value);

  if (!normalized) {
    return "Missing crosswordId";
  }

  if (normalized.length > MAX_CROSSWORD_ID_LENGTH) {
    return "Invalid crosswordId";
  }

  if (!CROSSWORD_ID_PATTERN.test(normalized)) {
    return "Invalid crosswordId";
  }

  return null;
}

module.exports = {
  normalizeCrosswordId,
  getCrosswordIdValidationError
};
