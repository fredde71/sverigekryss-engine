export function getActiveCells({
  activeCell,
  direction,
  cellTypes,
  cols,
  rows
}) {

  if (activeCell === null) {
    return new Set();
  }

  const isBlocked = (index) => cellTypes[index] !== "write";

  const cellType = cellTypes[activeCell];

  console.log("[single-clue-debug] getActiveCells input", {
    activeCell,
    cellType,
    direction
  });

  // CLUE CELL
  if (cellType === "double") {
    const startCell = direction === "across"
      ? activeCell + 1
      : activeCell + cols;

    const active = getNormalActiveCells({
      activeCell: startCell,
      direction,
      cellTypes,
      cols,
      rows,
      isBlocked
    });

    console.log("[single-clue-debug] getActiveCells double clue result", {
      clickedCell: activeCell,
      startCell,
      direction,
      activeCells: Array.from(active)
    });

    return active;
  }

  if (cellType === "blocked") {
    const startCell = getBlockedClueStartCell({
      activeCell,
      direction,
      cellTypes,
      cols,
      rows,
      isBlocked
    });

    const active = getNormalActiveCells({
      activeCell: startCell,
      direction,
      cellTypes,
      cols,
      rows,
      isBlocked
    });

    console.log("[single-clue-debug] getActiveCells blocked clue result", {
      clickedCell: activeCell,
      startCell,
      startCellType: startCell === null ? null : cellTypes[startCell],
      direction,
      activeCells: Array.from(active)
    });

    return active;
  }

  const active = getNormalActiveCells({
    activeCell,
    direction,
    cellTypes,
    cols,
    rows,
    isBlocked
  });

  console.log("[single-clue-debug] getActiveCells write cell result", {
    startCell: activeCell,
    direction,
    activeCells: Array.from(active)
  });

  return active;
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

function getBlockedClueStartCell({
  activeCell,
  direction,
  cellTypes,
  cols,
  rows,
  isBlocked
}) {
  const candidate = direction === "across"
    ? activeCell + 1
    : activeCell + cols;

  const isCandidateInBounds = direction === "across"
    ? activeCell % cols !== cols - 1
    : candidate < rows * cols;

  const bestCandidate = (
    isCandidateInBounds &&
    candidate >= 0 &&
    candidate < rows * cols &&
    !isBlocked(candidate)
  ) ? candidate : null;

  console.log("[single-clue-debug] getBlockedClueStartCell result", {
    clickedCell: activeCell,
    direction,
    candidate,
    bestCandidate
  });

  return bestCandidate;
}
