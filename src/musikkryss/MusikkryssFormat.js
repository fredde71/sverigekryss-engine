export const MUSIKKRYSS_FIXED_FORMAT = deepFreeze({
  type: "musikkryss-format",
  version: 1,
  id: "musikkryss-recurring-v1",
  clueNumbers: Array.from({ length: 13 }, (_, index) => index + 1)
});

export function createEmptyMusikkryssContent() {
  return {
    formatId: MUSIKKRYSS_FIXED_FORMAT.id,
    introScript: "",
    clues: MUSIKKRYSS_FIXED_FORMAT.clueNumbers.map(number => ({
      number,
      contentSequence: [{ type: "text", text: "" }]
    }))
  };
}

export function normalizeMusikkryssContent(value) {
  const sourceClues = Array.isArray(value?.clues) ? value.clues : [];

  return {
    formatId: MUSIKKRYSS_FIXED_FORMAT.id,
    introScript: typeof value?.introScript === "string"
      ? value.introScript
      : "",
    clues: MUSIKKRYSS_FIXED_FORMAT.clueNumbers.map(number => {
      const source = sourceClues.find(clue => clue?.number === number);
      const textEntry = Array.isArray(source?.contentSequence)
        ? source.contentSequence.find(entry => entry?.type === "text")
        : null;

      return {
        number,
        contentSequence: [{
          type: "text",
          text: typeof textEntry?.text === "string" ? textEntry.text : ""
        }]
      };
    })
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
