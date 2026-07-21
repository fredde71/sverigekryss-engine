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
  const candidates = getAdjacentWriteCells({
    activeCell,
    cellTypes,
    cols,
    rows,
    isBlocked
  });

  console.log("[single-clue-debug] getBlockedClueStartCell candidates", {
    clickedCell: activeCell,
    direction,
    candidates
  });

  let bestCandidate = null;
  let bestLength = 0;

  candidates.forEach(candidate => {
    const activeCells = getNormalActiveCells({
      activeCell: candidate,
      direction,
      cellTypes,
      cols,
      rows,
      isBlocked
    });

    if (activeCells.size > bestLength) {
      bestCandidate = candidate;
      bestLength = activeCells.size;
    }
  });

  console.log("[single-clue-debug] getBlockedClueStartCell result", {
    clickedCell: activeCell,
    direction,
    bestCandidate,
    bestLength
  });

  return bestCandidate;
}

function getAdjacentWriteCells({
  activeCell,
  cellTypes,
  cols,
  rows,
  isBlocked
}) {
  const total = rows * cols;
  const col = activeCell % cols;
  const candidates = [];

  if (col < cols - 1) {
    candidates.push(activeCell + 1);
  }

  if (activeCell + cols < total) {
    candidates.push(activeCell + cols);
  }

  if (col > 0) {
    candidates.push(activeCell - 1);
  }

  if (activeCell - cols >= 0) {
    candidates.push(activeCell - cols);
  }

  return candidates.filter(index => !isBlocked(index));
}
