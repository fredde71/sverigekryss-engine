import {
  createEmptyMusikkryssContent,
  MUSIKKRYSS_FIXED_FORMAT,
  normalizeMusikkryssContent
} from "./MusikkryssFormat";

test("defines the recurring format as thirteen ordered clue numbers", () => {
  expect(MUSIKKRYSS_FIXED_FORMAT).toEqual({
    type: "musikkryss-format",
    version: 1,
    id: "musikkryss-recurring-v1",
    clueNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
  });
  expect(Object.isFrozen(MUSIKKRYSS_FIXED_FORMAT.clueNumbers)).toBe(true);
});

test("creates independent empty authoring content for the fixed format", () => {
  const first = createEmptyMusikkryssContent();
  const second = createEmptyMusikkryssContent();

  first.clues[0].contentSequence[0].text = "Ändrad";

  expect(second.clues[0].contentSequence[0].text).toBe("");
  expect(second.clues).toHaveLength(13);
});

test("normalizes intro and one text sequence per known clue without mutation", () => {
  const input = {
    formatId: "ignored-format",
    introScript: "Välkommen",
    clues: [{
      number: 2,
      contentSequence: [{ type: "text", text: "Ledtrådstext" }]
    }]
  };
  const before = JSON.stringify(input);

  const result = normalizeMusikkryssContent(input);

  expect(result.formatId).toBe(MUSIKKRYSS_FIXED_FORMAT.id);
  expect(result.introScript).toBe("Välkommen");
  expect(result.clues).toHaveLength(13);
  expect(result.clues[1]).toEqual({
    number: 2,
    contentSequence: [{ type: "text", text: "Ledtrådstext" }]
  });
  expect(result.clues[0].contentSequence[0].text).toBe("");
  expect(JSON.stringify(input)).toBe(before);
});
