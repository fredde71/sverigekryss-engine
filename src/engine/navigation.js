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

export function getArrowNextIndex({
  currentIndex,
  key,
  cols
}) {

  if (key === "ArrowRight") {
    return currentIndex + 1;
  }

  if (key === "ArrowDown") {
    return currentIndex + cols;
  }

  if (key === "ArrowLeft") {
    return currentIndex - 1;
  }

  if (key === "ArrowUp") {
    return currentIndex - cols;
  }

  return null;
}

export function focusNextInput({
  nextIndex,
  inputRefs
}) {

  const nextInput = inputRefs.current[nextIndex];

  if (nextInput) {
    nextInput.focus();
  }
}

export function getDirection({
  currentIndex,
  cols,
  rows,
  cellTypes
}) {

  const right = currentIndex + 1;
  const down = currentIndex + cols;

  const isRightWritable =
    right % cols !== 0 &&
    cellTypes[right] !== "image" &&
    cellTypes[right] !== "blocked" &&
    cellTypes[right] !== "double";

  const isDownWritable =
    down < rows * cols &&
    cellTypes[down] !== "image" &&
    cellTypes[down] !== "blocked" &&
    cellTypes[down] !== "double";

  if (isRightWritable && isDownWritable) {
    return "toggle";
  }

  if (isRightWritable) {
    return "across";
  }

  if (isDownWritable) {
    return "down";
  }

  return null;
}