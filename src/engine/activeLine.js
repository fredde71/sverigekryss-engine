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

  const active = new Set();

  const isBlocked = (index) => {
    return (
      cellTypes[index] === "image" ||
      cellTypes[index] === "blocked" ||
      cellTypes[index] === "double"
    );
  };

  const isDouble = cellTypes[activeCell] === "double";

  // DOUBLE CLUE
  if (isDouble) {

    // across
    let endA = activeCell;

    while (
      endA % cols !== cols - 1 &&
      !isBlocked(endA + 1)
    ) {
      endA++;
    }

    for (let i = activeCell; i <= endA; i++) {
      active.add(i);
    }

    // down
    let endD = activeCell;

    while (
      endD + cols < rows * cols &&
      !isBlocked(endD + cols)
    ) {
      endD += cols;
    }

    for (let i = activeCell; i <= endD; i += cols) {
      active.add(i);
    }

    return active;
  }

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