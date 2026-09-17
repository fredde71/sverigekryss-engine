import {
  createMusikkryssRuntimeSelection,
  directionLabel
} from "./musikkryssRuntimeAdapter";

test("adapts a directional Musikkryss answer to shared runtime selection", () => {
  const answer = {
    number: 1,
    direction: "down",
    answerPath: [0, 10, 20]
  };

  expect(createMusikkryssRuntimeSelection(answer)).toEqual({
    type: "musikkryss-answer-selection",
    id: "1:down",
    label: "1 lodrätt",
    number: 1,
    direction: "down",
    answerCellIndexes: [0, 10, 20]
  });
  expect(directionLabel("across")).toBe("vågrätt");
  expect(Object.isFrozen(
    createMusikkryssRuntimeSelection(answer).answerCellIndexes
  )).toBe(true);
});

test("does not fabricate a runtime selection from unavailable path data", () => {
  expect(createMusikkryssRuntimeSelection(null)).toBeNull();
  expect(createMusikkryssRuntimeSelection({
    number: 1,
    direction: "across",
    answerPath: []
  })).toBeNull();
});
