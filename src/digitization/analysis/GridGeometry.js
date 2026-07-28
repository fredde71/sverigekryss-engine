export function buildGridGeometry({
  horizontalCandidates = [],
  verticalCandidates = []
}) {
  if (horizontalCandidates.length < 2 || verticalCandidates.length < 2) {
    return null;
  }

  const horizontalLines = horizontalCandidates.map(candidate => candidate.position);
  const verticalLines = verticalCandidates.map(candidate => candidate.position);
  const top = horizontalLines[0];
  const left = verticalLines[0];
  const bottom = horizontalLines[horizontalLines.length - 1];
  const right = verticalLines[verticalLines.length - 1];

  return createGridGeometry({
    bounds: {
      top,
      left,
      width: right - left,
      height: bottom - top
    },
    horizontalLines,
    verticalLines,
    rows: horizontalLines.length - 1,
    cols: verticalLines.length - 1
  });
}

export function createGridGeometry({
  bounds,
  horizontalLines,
  verticalLines,
  rows,
  cols
}) {
  return {
    bounds,
    horizontalLines,
    verticalLines,
    rows,
    cols
  };
}
