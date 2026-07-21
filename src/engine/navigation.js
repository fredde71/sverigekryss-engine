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

  if (cellTypes[currentIndex] === "blocked") {
    const acrossLength = getBestDirectionalLength({
      currentIndex,
      direction: "across",
      cols,
      rows,
      cellTypes
    });
    const downLength = getBestDirectionalLength({
      currentIndex,
      direction: "down",
      cols,
      rows,
      cellTypes
    });

    if (acrossLength > 0 || downLength > 0) {
      return acrossLength >= downLength ? "across" : "down";
    }
  }

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

function getBestDirectionalLength({
  currentIndex,
  direction,
  cols,
  rows,
  cellTypes
}) {
  return getAdjacentWriteCells({
    currentIndex,
    cols,
    rows,
    cellTypes
  }).reduce((bestLength, index) => Math.max(
    bestLength,
    getDirectionalLength({
      startIndex: index,
      direction,
      cols,
      rows,
      cellTypes
    })
  ), 0);
}

function getDirectionalLength({
  startIndex,
  direction,
  cols,
  rows,
  cellTypes
}) {
  let start = startIndex;
  let end = startIndex;

  if (direction === "across") {
    while (
      start - 1 >= 0 &&
      start % cols !== 0 &&
      isWritableCell(cellTypes[start - 1])
    ) {
      start--;
    }

    while (
      end % cols !== cols - 1 &&
      isWritableCell(cellTypes[end + 1])
    ) {
      end++;
    }

    return end - start + 1;
  }

  while (
    start - cols >= 0 &&
    isWritableCell(cellTypes[start - cols])
  ) {
    start -= cols;
  }

  while (
    end + cols < rows * cols &&
    isWritableCell(cellTypes[end + cols])
  ) {
    end += cols;
  }

  return ((end - start) / cols) + 1;
}

function getAdjacentWriteCells({
  currentIndex,
  cols,
  rows,
  cellTypes
}) {
  const total = rows * cols;
  const col = currentIndex % cols;
  const candidates = [];

  if (col < cols - 1) {
    candidates.push(currentIndex + 1);
  }

  if (currentIndex + cols < total) {
    candidates.push(currentIndex + cols);
  }

  if (col > 0) {
    candidates.push(currentIndex - 1);
  }

  if (currentIndex - cols >= 0) {
    candidates.push(currentIndex - cols);
  }

  return candidates.filter(index => isWritableCell(cellTypes[index]));
}
