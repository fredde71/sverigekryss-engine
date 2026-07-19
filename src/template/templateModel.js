import {
  getFullDocumentArea,
  normalizeDocumentSize
} from "./documentGeometry";

export function createTemplate(input) {
  const rows = input.rows;
  const cols = input.cols;
  const documentSize = normalizeDocumentSize(input.documentSize);
  const competitionCells = normalizeCompetitionCells(input.competitionCells);

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

  return template;
}

export function normalizeTemplate(input, defaults = {}) {
  const rows = input.rows ?? defaults.rows;
  const cols = input.cols ?? defaults.cols;
  const documentSize = normalizeDocumentSize(
    input.documentSize ?? defaults.documentSize
  );
  const competitionCells = normalizeCompetitionCells(input.competitionCells);

  const template = {
    crosswordId: input.crosswordId ?? defaults.crosswordId,
    rows,
    cols,
    cellTypes: normalizeCellTypes({
      cellTypes: input.cellTypes,
      rows,
      cols
    }),
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

function toInteger(value) {
  const number = Number(value);

  return Number.isInteger(number) ? number : null;
}
