export function createMusikkryssRuntimeSelection(answer) {
  if (
    !answer
    || !Number.isInteger(answer.number)
    || (answer.direction !== "across" && answer.direction !== "down")
    || !Array.isArray(answer.answerPath)
    || answer.answerPath.length === 0
    || !answer.answerPath.every(Number.isInteger)
  ) {
    return null;
  }

  return Object.freeze({
    type: "musikkryss-answer-selection",
    id: `${answer.number}:${answer.direction}`,
    label: `${answer.number} ${directionLabel(answer.direction)}`,
    number: answer.number,
    direction: answer.direction,
    answerCellIndexes: Object.freeze([...answer.answerPath]),
    spokenContentSource: createSpokenContentSource(answer)
  });
}

export function createMusikkryssRuntimeCellLabels(format) {
  if (!Array.isArray(format?.numberedStartCells)) return Object.freeze({});

  return Object.freeze(Object.fromEntries(
    format.numberedStartCells.flatMap(start => (
      Number.isInteger(start?.cellIndex) && Number.isInteger(start?.number)
        ? [[start.cellIndex, String(start.number)]]
        : []
    ))
  ));
}

export function directionLabel(direction) {
  return direction === "down" ? "lodrätt" : "vågrätt";
}

function createSpokenContentSource(answer) {
  const contentSequence = Array.isArray(answer.contentSequence)
    ? answer.contentSequence.map(entry => Object.freeze({ ...entry }))
    : [];

  return Object.freeze({
    type: "musikkryss-spoken-content-source",
    version: 1,
    answerId: `${answer.number}:${answer.direction}`,
    contentSequence: Object.freeze(contentSequence)
  });
}
