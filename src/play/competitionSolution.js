const SOLUTION_LENGTH = 6;

export function buildCompetitionSolution({ template, answers = {} }) {
  const solution = Array(SOLUTION_LENGTH).fill(" ");

  getCompetitionMarkers(template).forEach(({ index, number }) => {
    if (!Number.isInteger(index) || !Number.isInteger(number)) return;
    if (number < 1 || number > SOLUTION_LENGTH) return;

    solution[number - 1] = answers[index] || " ";
  });

  return solution.join("");
}

function getCompetitionMarkers(template = {}) {
  return [
    ...getMarkersFromList(template.competitionCells),
    ...getMarkersFromObject(template.competitionCells),
    ...getMarkersFromList(template.competitionPositions),
    ...getMarkersFromObject(template.competitionPositions),
    ...getMarkersFromCellTypes(template.cellTypes)
  ]
    .filter(Boolean)
    .sort((a, b) => a.number - b.number);
}

function getMarkersFromList(value) {
  if (!Array.isArray(value)) return [];

  return value.map(entry => normalizeMarker(entry));
}

function getMarkersFromObject(value) {
  if (!value || Array.isArray(value) || typeof value !== "object") return [];

  return Object.entries(value).map(([key, entry]) => {
    if (typeof entry === "number") {
      return normalizeMarker({
        number: Number(key),
        index: entry
      });
    }

    return normalizeMarker({
      number: Number(key),
      ...entry
    });
  });
}

function getMarkersFromCellTypes(cellTypes = []) {
  if (!Array.isArray(cellTypes)) return [];

  return cellTypes.map((entry, index) => {
    if (!entry || typeof entry !== "object") return null;

    return normalizeMarker({
      index,
      ...entry
    });
  });
}

function normalizeMarker(entry) {
  if (!entry || typeof entry !== "object") return null;

  return {
    index: toInteger(entry.index ?? entry.cellIndex),
    number: toInteger(
      entry.number ??
      entry.position ??
      entry.competitionNumber ??
      entry.competitionPosition
    )
  };
}

function toInteger(value) {
  const number = Number(value);

  return Number.isInteger(number) ? number : null;
}
