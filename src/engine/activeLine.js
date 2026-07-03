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

    if (direction === "across") {
      let current = activeCell + 1;

      while (
        current < rows * cols &&
        current % cols !== 0 &&
        Math.floor(current / cols) === Math.floor(activeCell / cols) &&
        !isBlocked(current)
      ) {
        active.add(current);
        current++;
      }

      return active;
    }

    let current = activeCell + cols;

    while (
      current < rows * cols &&
      !isBlocked(current)
    ) {
      active.add(current);
      current += cols;
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
