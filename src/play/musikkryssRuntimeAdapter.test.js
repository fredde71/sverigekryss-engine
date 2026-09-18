import {
  createMusikkryssRuntimeCellLabels,
  createMusikkryssRuntimeSelection,
  directionLabel
} from "./musikkryssRuntimeAdapter";
import { MUSIKKRYSS_FIXED_FORMAT } from "../musikkryss/MusikkryssFormat";

test("adapts a directional Musikkryss answer to shared runtime selection", () => {
  const answer = {
    number: 1,
    direction: "down",
    answerPath: [0, 10, 20],
    contentSequence: [{ type: "text", text: "Fråga ett lodrätt" }]
  };

  expect(createMusikkryssRuntimeSelection(answer)).toEqual({
    type: "musikkryss-answer-selection",
    id: "1:down",
    label: "1 lodrätt",
    number: 1,
    direction: "down",
    answerCellIndexes: [0, 10, 20],
    spokenContentSource: {
      type: "musikkryss-spoken-content-source",
      version: 1,
      answerId: "1:down",
      contentSequence: [{ type: "text", text: "Fråga ett lodrätt" }]
    }
  });
  expect(directionLabel("across")).toBe("vågrätt");
  expect(Object.isFrozen(
    createMusikkryssRuntimeSelection(answer).answerCellIndexes
  )).toBe(true);
  expect(Object.isFrozen(
    createMusikkryssRuntimeSelection(answer).spokenContentSource.contentSequence
  )).toBe(true);
});

test("projects fixed numbered start cells into immutable runtime labels", () => {
  const labels = createMusikkryssRuntimeCellLabels(MUSIKKRYSS_FIXED_FORMAT);

  expect(labels[0]).toBe("1");
  expect(labels[2]).toBe("2");
  expect(labels[82]).toBe("13");
  expect(Object.keys(labels)).toHaveLength(13);
  expect(Object.isFrozen(labels)).toBe(true);
});

test("does not fabricate a runtime selection from unavailable path data", () => {
  expect(createMusikkryssRuntimeSelection(null)).toBeNull();
  expect(createMusikkryssRuntimeSelection({
    number: 1,
    direction: "across",
    answerPath: []
  })).toBeNull();
});
