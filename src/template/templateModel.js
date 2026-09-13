import {
  getFullDocumentArea,
  normalizeDocumentSize
} from "./documentGeometry";

export function createTemplate(input) {
  const rows = input.rows;
  const cols = input.cols;
  const documentSize = normalizeDocumentSize(input.documentSize);
  const competitionCells = normalizeCompetitionCells(input.competitionCells);
  const answerPaths = normalizeAnswerPaths({
    answerPaths: input.answerPaths,
    rows,
    cols,
    cellTypes: input.cellTypes
  });
  const explicitLinePositions = normalizeExplicitLinePositions({
    horizontalLinePositions: input.horizontalLinePositions,
    verticalLinePositions: input.verticalLinePositions,
    rows,
    cols
  });

  const template = {
    crosswordId: input.crosswordId,
    rows,
    cols,
    cellTypes: normalizeCellTypes({
      cellTypes: input.cellTypes,
      rows,
      cols
    }),
    documentSize,
    gridArea: input.gridArea,
    cropArea: normalizeCropArea(input.cropArea, documentSize),
    imageSrc: input.imageSrc,
    metadata: input.metadata
  };

  if (competitionCells.length > 0) {
    template.competitionCells = competitionCells;
  }

  if (answerPaths.length > 0) {
    template.answerPaths = answerPaths;
  }

  if (explicitLinePositions) {
    Object.assign(template, explicitLinePositions);
  }

  return template;
}

export function normalizeTemplate(input, defaults = {}) {
  const rows = input.rows ?? defaults.rows;
  const cols = input.cols ?? defaults.cols;
  const documentSize = normalizeDocumentSize(
    input.documentSize ?? defaults.documentSize
  );
  const competitionCells = normalizeCompetitionCells(input.competitionCells);
  const cellTypes = normalizeCellTypes({
    cellTypes: input.cellTypes,
    rows,
    cols
  });
  const answerPaths = normalizeAnswerPaths({
    answerPaths: input.answerPaths,
    rows,
    cols,
    cellTypes
  });
  const explicitLinePositions = normalizeExplicitLinePositions({
    horizontalLinePositions: input.horizontalLinePositions,
    verticalLinePositions: input.verticalLinePositions,
    rows,
    cols
  });

  const template = {
    crosswordId: input.crosswordId ?? defaults.crosswordId,
    rows,
    cols,
    cellTypes,
    documentSize,
    gridArea: input.gridArea ?? defaults.gridArea,
    cropArea: normalizeCropArea(
      input.cropArea ?? defaults.cropArea,
      documentSize
    ),
    imageSrc: input.imageSrc ?? defaults.imageSrc,
    metadata: input.metadata ?? defaults.metadata
  };

  if (competitionCells.length > 0) {
    template.competitionCells = competitionCells;
  }

  if (answerPaths.length > 0) {
    template.answerPaths = answerPaths;
  }

  if (explicitLinePositions) {
    Object.assign(template, explicitLinePositions);
  }

  return template;
}

function normalizeCropArea(cropArea, documentSize) {
  return cropArea ?? getFullDocumentArea(documentSize);
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

function normalizeCompetitionCells(competitionCells) {
  if (!Array.isArray(competitionCells)) return [];

  const usedPositions = new Set();
  const usedIndexes = new Set();
  const normalized = [];

  competitionCells.forEach(entry => {
    const index = toInteger(entry?.index);
    const position = toInteger(entry?.position);

    if (index === null || index < 0) return;
    if (position === null || position < 1 || position > 6) return;
    if (usedPositions.has(position) || usedIndexes.has(index)) return;

    usedPositions.add(position);
    usedIndexes.add(index);
    normalized.push({
      index,
      position
    });
  });

  return normalized.sort((a, b) => a.position - b.position);
}

function normalizeAnswerPaths({ answerPaths, rows, cols, cellTypes }) {
  if (!Array.isArray(answerPaths)) return [];

  const normalizedCellTypes = normalizeCellTypes({ cellTypes, rows, cols });
  const total = rows * cols;
  const usedClueIndexes = new Set();
  const normalized = [];

  answerPaths.forEach(entry => {
    const clueIndex = toInteger(entry?.clueIndex);
    if (
      clueIndex === null
      || clueIndex < 0
      || clueIndex >= total
      || usedClueIndexes.has(clueIndex)
    ) return;

    const clueType = normalizedCellTypes[clueIndex];
    const maximumPathCount = clueType === "double"
      ? 2
      : clueType === "blocked"
        ? 1
        : 0;
    if (maximumPathCount === 0 || !Array.isArray(entry.paths)) return;

    const usedDirections = new Set();
    const paths = [];

    entry.paths.forEach(path => {
      if (paths.length >= maximumPathCount) return;

      const direction = path?.direction;
      if (
        (direction !== "across" && direction !== "down")
        || usedDirections.has(direction)
        || !Array.isArray(path.cellIndexes)
        || path.cellIndexes.length === 0
      ) return;

      const usedCellIndexes = new Set();
      const cellIndexes = [];
      for (const value of path.cellIndexes) {
        const cellIndex = toInteger(value);
        if (
          cellIndex === null
          || cellIndex < 0
          || cellIndex >= total
          || normalizedCellTypes[cellIndex] !== "write"
          || usedCellIndexes.has(cellIndex)
        ) return;
        usedCellIndexes.add(cellIndex);
        cellIndexes.push(cellIndex);
      }

      usedDirections.add(direction);
      paths.push({ direction, cellIndexes });
    });

    if (paths.length === 0) return;

    usedClueIndexes.add(clueIndex);
    normalized.push({ clueIndex, paths });
  });

  return normalized;
}

function normalizeExplicitLinePositions({
  horizontalLinePositions,
  verticalLinePositions,
  rows,
  cols
}) {
  if (
    !hasStrictlyIncreasingFinitePositions(horizontalLinePositions, rows + 1)
    || !hasStrictlyIncreasingFinitePositions(verticalLinePositions, cols + 1)
  ) {
    return null;
  }

  return {
    horizontalLinePositions: [...horizontalLinePositions],
    verticalLinePositions: [...verticalLinePositions]
  };
}

function hasStrictlyIncreasingFinitePositions(positions, expectedLength) {
  return Array.isArray(positions)
    && positions.length === expectedLength
    && positions.every((position, index) => (
      Number.isFinite(position)
      && (index === 0 || position > positions[index - 1])
    ));
}

function toInteger(value) {
  const number = Number(value);

  return Number.isInteger(number) ? number : null;
}
