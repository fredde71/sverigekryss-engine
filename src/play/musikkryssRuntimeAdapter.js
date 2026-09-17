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
    answerCellIndexes: Object.freeze([...answer.answerPath])
  });
}

export function directionLabel(direction) {
  return direction === "down" ? "lodrätt" : "vågrätt";
}
