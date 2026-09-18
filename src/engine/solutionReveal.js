export const SOLUTION_REVEAL_ACTIONS = Object.freeze({
  LETTER: "letter",
  ANSWER: "answer",
  ALL: "all"
});

export function createSolutionRevealState(cellLetters = {}) {
  return freezeRevealState(cellLetters);
}

export function applySolutionReveal({
  state = createSolutionRevealState(),
  action,
  answerCellIndexes = [],
  solutionIndex
}) {
  const canonicalCellLetters = solutionIndex?.cellLetters || {};
  const currentLetters = state.cellLetters || {};
  const indexes = action === SOLUTION_REVEAL_ACTIONS.ALL
    ? orderedCanonicalIndexes(canonicalCellLetters)
    : validAnswerIndexes(answerCellIndexes, canonicalCellLetters);
  const indexesToReveal = action === SOLUTION_REVEAL_ACTIONS.LETTER
    ? indexes.filter(index => !Object.hasOwn(currentLetters, index)).slice(0, 1)
    : action === SOLUTION_REVEAL_ACTIONS.ANSWER
      || action === SOLUTION_REVEAL_ACTIONS.ALL
      ? indexes
      : [];

  if (indexesToReveal.length === 0) return state;

  const nextLetters = { ...currentLetters };
  indexesToReveal.forEach(index => {
    nextLetters[index] = canonicalCellLetters[index];
  });

  return freezeRevealState(nextLetters);
}

function validAnswerIndexes(answerCellIndexes, canonicalCellLetters) {
  if (!Array.isArray(answerCellIndexes)) return [];

  return answerCellIndexes.filter(index => (
    Number.isInteger(index)
    && Object.hasOwn(canonicalCellLetters, index)
  ));
}

function orderedCanonicalIndexes(cellLetters) {
  return Object.keys(cellLetters)
    .map(Number)
    .filter(Number.isInteger)
    .sort((a, b) => a - b);
}

function freezeRevealState(cellLetters) {
  return Object.freeze({
    type: "solution-reveal-state",
    version: 1,
    cellLetters: Object.freeze({ ...cellLetters })
  });
}
