const CLUE_CELL_TYPES = new Set(["blocked", "double"]);

export function resolveClueSelection({
  currentIndex,
  currentDirection,
  cols,
  rows,
  cellTypes,
  answerPaths = []
}) {
  if (
    !Number.isInteger(currentIndex)
    || !Number.isInteger(cols)
    || cols <= 0
    || !Number.isInteger(rows)
    || rows <= 0
    || !Array.isArray(cellTypes)
    || currentIndex < 0
    || currentIndex >= rows * cols
  ) {
    return null;
  }

  const clueType = cellTypes[currentIndex];
  if (!CLUE_CELL_TYPES.has(clueType)) {
    return null;
  }

  const explicitSelection = resolveExplicitAnswerPath({
    currentIndex,
    currentDirection,
    clueType,
    answerPaths
  });
  if (explicitSelection) return explicitSelection;

  const candidates = {
    across: createAnswerCandidate({
      clueIndex: currentIndex,
      direction: "across",
      cols,
      rows,
      cellTypes
    }),
    down: createAnswerCandidate({
      clueIndex: currentIndex,
      direction: "down",
      cols,
      rows,
      cellTypes
    })
  };
  const direction = clueType === "double"
    ? resolveDoubleDirection(candidates, currentDirection)
    : resolveSingleDirection(candidates);

  if (!direction) {
    return null;
  }

  return Object.freeze({
    clueIndex: currentIndex,
    clueType,
    direction,
    answerStartIndex: candidates[direction].answerStartIndex,
    answerLength: candidates[direction].answerLength,
    answerCellIndexes: Object.freeze([
      ...candidates[direction].answerCellIndexes
    ])
  });
}

function resolveExplicitAnswerPath({
  currentIndex,
  currentDirection,
  clueType,
  answerPaths
}) {
  if (!Array.isArray(answerPaths)) return null;

  const entry = answerPaths.find(candidate => candidate?.clueIndex === currentIndex);
  if (!entry || !Array.isArray(entry.paths) || entry.paths.length === 0) {
    return null;
  }

  const pathsByDirection = Object.fromEntries(
    entry.paths
      .filter(path => (
        (path?.direction === "across" || path?.direction === "down")
        && Array.isArray(path.cellIndexes)
        && path.cellIndexes.length > 0
      ))
      .map(path => [path.direction, path])
  );
  const direction = clueType === "double"
    ? resolveDoubleDirection(pathsByDirection, currentDirection)
    : resolveSingleDirection(pathsByDirection);
  const path = pathsByDirection[direction];

  if (!path) return null;

  return Object.freeze({
    clueIndex: currentIndex,
    clueType,
    direction,
    answerStartIndex: path.cellIndexes[0],
    answerLength: path.cellIndexes.length,
    answerCellIndexes: Object.freeze([...path.cellIndexes])
  });
}

function createAnswerCandidate({
  clueIndex,
  direction,
  cols,
  rows,
  cellTypes
}) {
  const answerStartIndex = direction === "across"
    ? clueIndex + 1
    : clueIndex + cols;
  const inBounds = direction === "across"
    ? clueIndex % cols !== cols - 1
    : answerStartIndex < rows * cols;

  if (!inBounds || cellTypes[answerStartIndex] !== "write") {
    return null;
  }

  const answerCellIndexes = [];
  let index = answerStartIndex;
  while (
    index < rows * cols
    && cellTypes[index] === "write"
    && (
      direction === "down"
      || Math.floor(index / cols) === Math.floor(answerStartIndex / cols)
    )
  ) {
    answerCellIndexes.push(index);
    index += direction === "across" ? 1 : cols;
  }

  return {
    direction,
    answerStartIndex,
    answerLength: answerCellIndexes.length,
    answerCellIndexes
  };
}

function resolveDoubleDirection(candidates, currentDirection) {
  if (candidates.across && candidates.down) {
    return currentDirection === "down" ? "across" : "down";
  }
  if (candidates.across) return "across";
  if (candidates.down) return "down";
  return null;
}

function resolveSingleDirection(candidates) {
  if (candidates.across && candidates.down) {
    return candidates.across.answerLength >= candidates.down.answerLength
      ? "across"
      : "down";
  }
  if (candidates.across) return "across";
  if (candidates.down) return "down";
  return null;
}
