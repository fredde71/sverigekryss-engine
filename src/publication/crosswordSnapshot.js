import { normalizeTemplate } from "../template/templateModel";

export function createCrosswordSnapshot(template) {
  const normalizedTemplate = normalizeTemplate(cloneValue(template));

  return deepFreeze({
    type: "crossword-snapshot",
    version: 1,
    crosswordId: normalizedTemplate.crosswordId,
    template: normalizedTemplate
  });
}

export function normalizeCrosswordSnapshot(value) {
  if (value?.type !== "crossword-snapshot" || value?.version !== 1) {
    return null;
  }

  return createCrosswordSnapshot(value.template);
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)])
  );
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
