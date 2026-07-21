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
      isWritableCell(cellTypes[next])
    ) {
      nextIndex = next;
    }

  } else {

    const next = currentIndex + cols;

    if (
      next < rows * cols &&
      isWritableCell(cellTypes[next])
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
    isWritableCell(cellTypes[right]);

  const isDownWritable =
    down < rows * cols &&
    isWritableCell(cellTypes[down]);

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

function isWritableCell(type) {
  return type === "write";
}
