function hasCompleteTemplateSolutions(template) {
  const answers = collectAnswers(template);
  const expectedAnswerCount = getExpectedAnswerCount(template);
  if (
    expectedAnswerCount === 0
    || answers.length !== expectedAnswerCount
  ) return false;

  const cellLetters = new Map();
  for (const answer of answers) {
    const letters = normalizeCompleteSolution(answer.solution, answer.answerPath);
    if (!letters) return false;

    for (let offset = 0; offset < letters.length; offset += 1) {
      const cellIndex = answer.answerPath[offset];
      const existing = cellLetters.get(cellIndex);
      if (existing !== undefined && existing !== letters[offset]) return false;
      cellLetters.set(cellIndex, letters[offset]);
    }
  }

  return true;
}

function getExpectedAnswerCount(template) {
  if (template?.crosswordType === "musikkryss") {
    return Array.isArray(template.musikkryss?.answers)
      ? template.musikkryss.answers.length
      : 0;
  }

  return Array.isArray(template?.cellTypes)
    ? template.cellTypes.reduce((count, cellType) => (
      count + (cellType === "double" ? 2 : cellType === "blocked" ? 1 : 0)
    ), 0)
    : 0;
}

function collectAnswers(template) {
  if (template?.crosswordType === "musikkryss") {
    return Array.isArray(template.musikkryss?.answers)
      ? template.musikkryss.answers
      : [];
  }

  return Array.isArray(template?.answerPaths)
    ? template.answerPaths.flatMap(entry => (
      Array.isArray(entry.paths) ? entry.paths.map(path => ({
        answerPath: path.cellIndexes,
        solution: path.solution
      })) : []
    ))
    : [];
}

function normalizeCompleteSolution(value, answerPath) {
  if (typeof value !== "string" || !Array.isArray(answerPath)) return null;

  const letters = Array.from(value.normalize("NFC"));
  return letters.length === answerPath.length
    && letters.length > 0
    && letters.every(letter => !/\s/u.test(letter))
    ? letters
    : null;
}

module.exports = { hasCompleteTemplateSolutions };
