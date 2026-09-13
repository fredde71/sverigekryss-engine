export function getActiveCells({
  activeCell,
  direction,
  cellTypes,
  cols,
  rows,
  clueSelection = null
}) {

  if (activeCell === null) {
    return new Set();
  }

  const isBlocked = (index) => cellTypes[index] !== "write";

  const cellType = cellTypes[activeCell];
  const isClueCell = cellType === "blocked" || cellType === "double";
  const explicitAnswerCells = clueSelection?.answerCellIndexes;

  if (
    Array.isArray(explicitAnswerCells)
    && (
      clueSelection.clueIndex === activeCell
      || explicitAnswerCells.includes(activeCell)
    )
  ) {
    return new Set(explicitAnswerCells);
  }

  const answerStartIndex = isClueCell
    && clueSelection?.clueIndex === activeCell
    && clueSelection.direction === direction
    ? clueSelection.answerStartIndex
    : activeCell;

  if (isClueCell && answerStartIndex === activeCell) {
    return new Set();
  }

  return getNormalActiveCells({
    activeCell: answerStartIndex,
    direction,
    cellTypes,
    cols,
    rows,
    isBlocked
  });
}

function getNormalActiveCells({
  activeCell,
  direction,
  cellTypes,
  cols,
  rows,
  isBlocked
}) {
  if (activeCell === null || activeCell === undefined || isBlocked(activeCell)) {
    return new Set();
  }

  const active = new Set();

  // NORMAL ACROSS
  if (direction === "across") {

    let start = activeCell;

    while (
      start - 1 >= 0 &&
      start % cols !== 0 &&
      !isBlocked(start - 1)
    ) {
      start--;
    }

    let end = activeCell;

    while (
      end % cols !== cols - 1 &&
      !isBlocked(end + 1)
    ) {
      end++;
    }

    for (let i = start; i <= end; i++) {
      active.add(i);
    }

    return active;
  }

  // NORMAL DOWN
  let start = activeCell;

  while (
    start - cols >= 0 &&
    !isBlocked(start - cols)
  ) {
    start -= cols;
  }

  let end = activeCell;

  while (
    end + cols < rows * cols &&
    !isBlocked(end + cols)
  ) {
    end += cols;
  }

  for (let i = start; i <= end; i += cols) {
    active.add(i);
  }

  return active;
}
