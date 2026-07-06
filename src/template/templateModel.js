export function createTemplate(input) {
  const rows = input.rows;
  const cols = input.cols;

  return {
    crosswordId: input.crosswordId,
    rows,
    cols,
    cellTypes: normalizeCellTypes({
      cellTypes: input.cellTypes,
      rows,
      cols
    }),
    gridArea: input.gridArea,
    imageSrc: input.imageSrc,
    metadata: input.metadata
  };
}

function normalizeCellTypes({
  cellTypes,
  rows,
  cols
}) {
  const total = rows * cols;
  const normalized = Array(total).fill("empty");

  for (let i = 0; i < total; i++) {
    normalized[i] = cellTypes?.[i] || "empty";
  }

  return normalized;
}
