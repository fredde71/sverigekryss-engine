export function normalizeCanonicalSolution(value) {
  if (typeof value !== "string") return null;

  const normalized = value.normalize("NFC");
  return normalized.length > 0 ? normalized : null;
}

export function validateAnswerPathSolution(value, answerPath) {
  const normalized = normalizeCanonicalSolution(value);
  const expectedLength = Array.isArray(answerPath) ? answerPath.length : 0;
  const actualLength = normalized ? Array.from(normalized).length : 0;

  if (!normalized) {
    return deepFreeze({
      status: "incomplete",
      expectedLength,
      actualLength,
      diagnostics: []
    });
  }

  const diagnostics = [];
  if (actualLength !== expectedLength) {
    diagnostics.push({
      code: "solution-length-mismatch",
      expectedLength,
      actualLength
    });
  }
  if (Array.from(normalized).some(letter => /\s/u.test(letter))) {
    diagnostics.push({ code: "solution-contains-whitespace" });
  }

  return deepFreeze({
    status: diagnostics.length > 0 ? "invalid" : "valid",
    expectedLength,
    actualLength,
    diagnostics
  });
}

export function createTemplateSolutionIndex(template) {
  const expectedAnswers = collectExpectedAnswers(template);
  const expectedAnswerCount = getExpectedAnswerCount(template);
  const entries = collectSolutionEntries(template);
  const cellLetters = {};
  const conflicts = [];

  entries.forEach(entry => {
    Array.from(entry.solution).forEach((letter, offset) => {
      const cellIndex = entry.answerPath[offset];
      const existing = cellLetters[cellIndex];

      if (existing !== undefined && existing !== letter) {
        conflicts.push({
          cellIndex,
          existingLetter: existing,
          conflictingLetter: letter,
          answerId: entry.id
        });
        return;
      }

      cellLetters[cellIndex] = letter;
    });
  });

  return deepFreeze({
    type: "template-solution-index",
    version: 1,
    status: conflicts.length > 0
      ? "inconsistent"
      : entries.length > 0
        ? "available"
        : "unavailable",
    completenessStatus: conflicts.length > 0
      ? "inconsistent"
      : expectedAnswerCount > 0
        && expectedAnswers.length === expectedAnswerCount
        && entries.length === expectedAnswerCount
        ? "complete"
        : entries.length > 0
          ? "partial"
          : "unavailable",
    expectedAnswerCount,
    missingAnswerPathCount: Math.max(
      0,
      expectedAnswerCount - expectedAnswers.length
    ),
    solutionAnswerCount: entries.length,
    entries,
    cellLetters,
    conflicts
  });
}

export function hasCompleteTemplateSolutions(template) {
  const index = createTemplateSolutionIndex(template);
  return index.completenessStatus === "complete";
}

export function stripTemplateSolutions(template) {
  if (!template || typeof template !== "object") return template;

  const stripped = {
    ...template,
    ...(Array.isArray(template.answerPaths) ? {
      answerPaths: template.answerPaths.map(entry => ({
        ...entry,
        paths: entry.paths.map(({ solution, ...path }) => ({
          ...path,
          cellIndexes: [...path.cellIndexes]
        }))
      }))
    } : {}),
    ...(template.musikkryss ? {
      musikkryss: {
        ...template.musikkryss,
        answers: template.musikkryss.answers.map(({ solution, ...answer }) => ({
          ...answer,
          answerPath: [...answer.answerPath],
          contentSequence: answer.contentSequence.map(entry => ({ ...entry }))
        }))
      }
    } : {})
  };

  return stripped;
}

function collectSolutionEntries(template) {
  if (template?.crosswordType === "musikkryss") {
    return (template.musikkryss?.answers || []).flatMap(answer => {
      const solution = normalizeCompleteSolution(
        answer.solution,
        answer.answerPath
      );
      if (!solution) return [];

      return [{
        id: `musikkryss:${answer.number}:${answer.direction}`,
        answerRef: {
          type: "musikkryss-answer",
          number: answer.number,
          direction: answer.direction
        },
        answerPath: [...answer.answerPath],
        solution
      }];
    });
  }

  return (template?.answerPaths || []).flatMap(entry => (
    entry.paths.flatMap(path => {
      const solution = normalizeCompleteSolution(
        path.solution,
        path.cellIndexes
      );
      if (!solution) return [];

      return [{
        id: `sverigekryss:${entry.clueIndex}:${path.direction}`,
        answerRef: {
          type: "sverigekryss-clue-answer",
          clueIndex: entry.clueIndex,
          direction: path.direction
        },
        answerPath: [...path.cellIndexes],
        solution
      }];
    })
  ));
}

function normalizeCompleteSolution(value, answerPath) {
  const normalized = normalizeCanonicalSolution(value);
  if (!normalized) return null;

  return validateAnswerPathSolution(normalized, answerPath).status === "valid"
    ? normalized
    : null;
}

function collectExpectedAnswers(template) {
  if (template?.crosswordType === "musikkryss") {
    return (template.musikkryss?.answers || []).map(answer => ({
      id: `musikkryss:${answer.number}:${answer.direction}`,
      answerPath: answer.answerPath
    }));
  }

  return (template?.answerPaths || []).flatMap(entry => (
    entry.paths.map(path => ({
      id: `sverigekryss:${entry.clueIndex}:${path.direction}`,
      answerPath: path.cellIndexes
    }))
  ));
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

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
