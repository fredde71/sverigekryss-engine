export function getNextCell({
  currentIndex,
  direction,
  cols,
  rows,
  cellTypes
}) {

  let nextIndex;

  if (direction === "across") {

    const next = currentIndex + 1;

    if (
      next % cols !== 0 &&
      cellTypes[next] !== "image" &&
      cellTypes[next] !== "blocked" &&
      cellTypes[next] !== "double"
    ) {
      nextIndex = next;
    }

  } else {

    const next = currentIndex + cols;

    if (
      next < rows * cols &&
      cellTypes[next] !== "image" &&
      cellTypes[next] !== "blocked" &&
      cellTypes[next] !== "double"
    ) {
      nextIndex = next;
    }
  }

  return nextIndex;
}