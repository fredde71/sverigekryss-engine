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

export function normalizeTemplate(input, defaults = {}) {
  const rows = input.rows ?? defaults.rows;
  const cols = input.cols ?? defaults.cols;

  return {
    crosswordId: input.crosswordId ?? defaults.crosswordId,
    rows,
    cols,
    cellTypes: normalizeCellTypes({
      cellTypes: input.cellTypes,
      rows,
      cols
    }),
    gridArea: input.gridArea ?? defaults.gridArea,
    imageSrc: input.imageSrc ?? defaults.imageSrc,
    metadata: input.metadata ?? defaults.metadata
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
